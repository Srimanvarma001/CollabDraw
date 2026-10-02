import { Tool } from "@/components/Canvas";
import { getRoomState } from "./http";
import { DrawOp, Shape, ShapeWithoutId, applyOp, newShapeId, parseRoomMessage } from "./shapes";
import { getBounds, hitTest, isPointNearShape, translateShape } from "./geometry";

export type { Shape } from "./shapes";

/** One undoable user action, expressed as the ops that undo and redo it. */
interface HistoryEntry {
    undo: DrawOp[];
    redo: DrawOp[];
}

interface Cursor {
    x: number;
    y: number;
    userName?: string;
    userId: string;
}

export interface UserPresence {
    userId: string;
    userName: string;
}

interface Camera {
    x: number;
    y: number;
    zoom: number;
}

export class Game {

    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private existingShapes: Shape[]
    private undoStack: HistoryEntry[] = [];
    private redoStack: HistoryEntry[] = [];
    // Until the room history has loaded, ops are queued and replayed on top of it.
    private loaded = false;
    private pendingOps: DrawOp[] = [];
    private loadId = 0;
    private erasedThisStroke: Shape[] = [];
    // Select tool: the selected shape, and the drag in progress if any.
    private selectedId: string | null = null;
    private drag: { startX: number; startY: number; original: Shape; moved: boolean } | null = null;
    private roomId: string;
    private clicked: boolean;
    private startX = 0;
    private startY = 0;
    private selectedTool: Tool = "circle";
    public strokeColor: string = "#ffffff";
    public strokeWidth: number = 2;
    private currentPath: { x: number; y: number }[] = [];
    private cursors: Map<string, Cursor> = new Map();
    private lastCursorSent = 0;
    private cursorUpdateInterval = 50;
    private lastZoomTime = 0;
    private zoomThrottleMs = 16;

    private camera: Camera = { x: 0, y: 0, zoom: 1 };
    private isPanning: boolean = false;
    private panStart: { x: number; y: number } = { x: 0, y: 0 };
    private spacePressed: boolean = false;

    socket: WebSocket;
    // Ops made while disconnected; sent once a new socket is attached.
    private outbox: DrawOp[] = [];

    constructor(canvas: HTMLCanvasElement, roomId: string, socket: WebSocket) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d")!;
        this.existingShapes = [];
        this.roomId = roomId;
        this.socket = socket;
        this.clicked = false;
        this.init();
        this.socket.addEventListener("message", this.messageHandler);
        this.initMouseHandlers();
        this.initKeyboardHandlers();
        this.initResizeHandler();
    }

    private resizeHandler = () => {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.redrawCanvas();
    };

    private initResizeHandler() {
        window.addEventListener("resize", this.resizeHandler);
    }

    destroy() {
        this.socket.removeEventListener("message", this.messageHandler);
        this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
        this.canvas.removeEventListener("mouseup", this.mouseUpHandler);
        this.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
        this.canvas.removeEventListener("wheel", this.wheelHandler, false);
        window.removeEventListener("keydown", this.keyDownHandler);
        window.removeEventListener("keyup", this.keyUpHandler);
        window.removeEventListener("resize", this.resizeHandler);
    }

    setTool(tool: Tool) {
        this.selectedTool = tool;
        if (tool !== "select" && this.selectedId) {
            this.selectedId = null;
            this.redrawCanvas();
        }
    }

    setStrokeColor(color: string) {
        this.strokeColor = color;
    }

    setStrokeWidth(width: number) {
        this.strokeWidth = width;
    }

    /** Places text at a screen position; `fontSize` is in screen pixels. */
    addText(screenX: number, screenY: number, text: string, color: string, fontSize: number) {
        const world = this.screenToWorld(screenX, screenY);
        const worldFontSize = fontSize / this.camera.zoom;
        this.addShape({
            type: "text",
            // The input box's top-left is at the click; canvas text is drawn from its baseline.
            x: world.x,
            y: world.y + worldFontSize,
            text,
            fontSize: worldFontSize,
            strokeColor: color
        });
    }

    getZoom(): number {
        return this.camera.zoom;
    }

    setZoom(newZoom: number, centerX?: number, centerY?: number) {
        const cx = centerX ?? this.canvas.width / 2;
        const cy = centerY ?? this.canvas.height / 2;

        const newZoomClamped = Math.min(Math.max(newZoom, 0.1), 20);

        this.camera.x = cx - (cx - this.camera.x) * (newZoomClamped / this.camera.zoom);
        this.camera.y = cy - (cy - this.camera.y) * (newZoomClamped / this.camera.zoom);
        this.camera.zoom = newZoomClamped;

        this.redrawCanvas();
    }

    zoomIn(centerX?: number, centerY?: number) {
        this.setZoom(this.camera.zoom * 1.1, centerX, centerY);
    }

    zoomOut(centerX?: number, centerY?: number) {
        this.setZoom(this.camera.zoom * 0.9, centerX, centerY);
    }

    resetView() {
        this.camera = { x: 0, y: 0, zoom: 1 };
        this.redrawCanvas();
    }

    undo() {
        const entry = this.undoStack.pop();
        if (!entry) return;
        this.applyLocal(entry.undo);
        this.redoStack.push(entry);
    }

    redo() {
        const entry = this.redoStack.pop();
        if (!entry) return;
        this.applyLocal(entry.redo);
        this.undoStack.push(entry);
    }

    canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    /** Applies ops locally and sends them to the room. */
    private applyLocal(ops: DrawOp[]) {
        for (const op of ops) {
            this.applyOp(op);
            this.sendOp(op);
        }
        this.redrawCanvas();
    }

    private applyOp(op: DrawOp) {
        if (!this.loaded) {
            this.pendingOps.push(op);
        }
        this.existingShapes = applyOp(this.existingShapes, op);
    }

    /** Applies and sends `redo`, and records the action so it can be undone. */
    private perform(redo: DrawOp[], undo: DrawOp[]) {
        this.applyLocal(redo);
        this.record(redo, undo);
    }

    /** Records an action whose ops were already applied and sent. */
    private record(redo: DrawOp[], undo: DrawOp[]) {
        this.undoStack.push({ undo, redo });
        this.redoStack = [];
    }

    private addShape(shape: ShapeWithoutId) {
        const withId = { ...shape, id: newShapeId() } as Shape;
        this.perform([{ op: "add", shape: withId }], [{ op: "delete", ids: [withId.id] }]);
    }

    private sendOp(op: DrawOp) {
        if (this.socket.readyState !== WebSocket.OPEN) {
            this.outbox.push(op);
            return;
        }
        this.socket.send(JSON.stringify({
            type: "chat",
            message: JSON.stringify(op),
            roomId: this.roomId
        }));
    }

    /** Updates who is in the room and drops the cursors of people who left. */
    setUsers(users: UserPresence[]) {
        const present = new Set(users.map(u => u.userId));
        for (const id of this.cursors.keys()) {
            if (!present.has(id)) this.cursors.delete(id);
        }
        this.redrawCanvas();
    }

    private screenToWorld(screenX: number, screenY: number) {
        return {
            x: (screenX - this.camera.x) / this.camera.zoom,
            y: (screenY - this.camera.y) / this.camera.zoom,
        };
    }

    private worldToScreen(worldX: number, worldY: number) {
        return {
            x: worldX * this.camera.zoom + this.camera.x,
            y: worldY * this.camera.zoom + this.camera.y,
        };
    }

    private redrawCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "#0f0f14";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawGrid();

        this.ctx.save();
        this.ctx.translate(this.camera.x, this.camera.y);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);

        this.existingShapes.filter(Boolean).forEach((shape) => {
            this.drawShape(shape);
        });
        this.drawSelection();

        this.ctx.restore();

        this.drawCursors();
    }

    private getSelectedShape(): Shape | null {
        if (!this.selectedId) return null;
        return this.existingShapes.find(s => s.id === this.selectedId) ?? null;
    }

    private drawSelection() {
        const shape = this.getSelectedShape();
        if (!shape) return;
        const b = getBounds(shape);
        const pad = 6 / this.camera.zoom;
        this.ctx.save();
        this.ctx.strokeStyle = "#3b82f6";
        this.ctx.lineWidth = 1 / this.camera.zoom;
        this.ctx.setLineDash([4 / this.camera.zoom, 4 / this.camera.zoom]);
        this.ctx.strokeRect(b.minX - pad, b.minY - pad, b.maxX - b.minX + pad * 2, b.maxY - b.minY + pad * 2);
        this.ctx.restore();
    }

    /** Deletes the selected shape (undoable). */
    deleteSelected() {
        const shape = this.getSelectedShape();
        if (!shape) return;
        this.selectedId = null;
        this.perform([{ op: "delete", ids: [shape.id] }], [{ op: "add", shape }]);
    }

    private drawGrid() {
        const gridSize = 20;
        const dotSize = 1;
        const dotColor = "rgba(255, 255, 255, 0.06)";

        const startX = Math.floor(-this.camera.x / this.camera.zoom / gridSize) * gridSize - gridSize;
        const startY = Math.floor(-this.camera.y / this.camera.zoom / gridSize) * gridSize - gridSize;

        const endX = startX + this.canvas.width / this.camera.zoom + gridSize * 2;
        const endY = startY + this.canvas.height / this.camera.zoom + gridSize * 2;

        this.ctx.fillStyle = dotColor;
        for (let x = startX; x < endX; x += gridSize) {
            for (let y = startY; y < endY; y += gridSize) {
                const screenPos = this.worldToScreen(x, y);
                this.ctx.beginPath();
                this.ctx.arc(screenPos.x, screenPos.y, dotSize * this.camera.zoom, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    private drawCursors() {
        this.cursors.forEach((cursor) => {
            const screenPos = this.worldToScreen(cursor.x, cursor.y);
            
            this.ctx.save();
            this.ctx.translate(this.camera.x, this.camera.y);
            this.ctx.scale(this.camera.zoom, this.camera.zoom);

            this.ctx.beginPath();
            this.ctx.fillStyle = "#3b82f6";
            this.ctx.moveTo(cursor.x, cursor.y);
            this.ctx.lineTo(cursor.x + 12, cursor.y + 10);
            this.ctx.lineTo(cursor.x + 4, cursor.y + 10);
            this.ctx.lineTo(cursor.x + 4, cursor.y + 18);
            this.ctx.closePath();
            this.ctx.fill();
            
            if (cursor.userName) {
                this.ctx.font = "12px sans-serif";
                this.ctx.fillStyle = "#fff";
                this.ctx.fillText(cursor.userName, cursor.x + 14, cursor.y + 20);
            }

            this.ctx.restore();
        });
    }

    private drawShape(shape: Shape) {
        this.ctx.strokeStyle = shape.strokeColor;
        if (shape.type !== "text") {
            this.ctx.lineWidth = shape.strokeWidth;
        }
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";

        if (shape.type === "text") {
            this.ctx.font = `${shape.fontSize}px sans-serif`;
            this.ctx.fillStyle = shape.strokeColor;
            this.ctx.fillText(shape.text, shape.x, shape.y);
        } else if (shape.type === "rect") {
            this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        } else if (shape.type === "circle") {
            this.ctx.beginPath();
            this.ctx.arc(shape.centerX, shape.centerY, Math.abs(shape.radius), 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.closePath();
        } else if (shape.type === "line") {
            this.ctx.beginPath();
            this.ctx.moveTo(shape.startX, shape.startY);
            this.ctx.lineTo(shape.endX, shape.endY);
            this.ctx.stroke();
            this.ctx.closePath();
        } else if (shape.type === "arrow") {
            this.drawArrow(shape.startX, shape.startY, shape.endX, shape.endY);
        } else if (shape.type === "pencil" && shape.points.length > 0) {
            this.ctx.beginPath();
            this.ctx.moveTo(shape.points[0].x, shape.points[0].y);
            for (let i = 1; i < shape.points.length; i++) {
                this.ctx.lineTo(shape.points[i].x, shape.points[i].y);
            }
            this.ctx.stroke();
            this.ctx.closePath();
        }
    }

    private drawArrow(fromX: number, fromY: number, toX: number, toY: number) {
        const headLength = 15;
        const angle = Math.atan2(toY - fromY, toX - fromX);
        
        this.ctx.beginPath();
        this.ctx.moveTo(fromX, fromY);
        this.ctx.lineTo(toX, toY);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(toX, toY);
        this.ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
        this.ctx.moveTo(toX, toY);
        this.ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
        this.ctx.stroke();
    }

    /**
     * Switches to a new (already joined) socket after a reconnect: sends
     * whatever was drawn while offline, then reloads the room to pick up
     * what others drew in the meantime. Local undo history is kept.
     */
    setSocket(socket: WebSocket) {
        if (socket === this.socket) return;
        this.socket.removeEventListener("message", this.messageHandler);
        this.socket = socket;
        this.socket.addEventListener("message", this.messageHandler);

        const unsent = this.outbox;
        this.outbox = [];
        this.loaded = false;
        // Unsent ops may not be stored yet when the history is fetched,
        // so make sure they are reapplied on top of it.
        this.pendingOps = [...unsent];
        for (const op of unsent) {
            this.sendOp(op);
        }
        this.init();
    }

    async init() {
        // A reconnect can start a new load while an older one is in flight;
        // only the newest load may apply its result.
        const loadId = ++this.loadId;
        try {
            const state = await getRoomState(this.roomId);
            if (loadId !== this.loadId) return;
            let shapes = state.shapes;
            // Ops that arrived (or were made locally) while loading may or may
            // not be in the loaded history; ops are idempotent, so reapply them.
            for (const op of this.pendingOps) {
                shapes = applyOp(shapes, op);
            }
            this.existingShapes = shapes;
        } catch (e) {
            if (loadId !== this.loadId) return;
            console.error("Failed to load room history", e);
        }
        this.pendingOps = [];
        this.loaded = true;
        this.redrawCanvas();
    }

    private messageHandler = (event: MessageEvent) => {
        let message;
        try {
            message = JSON.parse(event.data);
        } catch {
            return;
        }

        if (message.type === "chat" && typeof message.message === "string") {
            for (const msg of parseRoomMessage(message.message, newShapeId())) {
                if (msg.op === "chat") continue;
                this.applyOp(msg);
            }
            this.redrawCanvas();
        } else if (message.type === "cursor") {
            this.cursors.set(message.userId, {
                x: message.cursor.x,
                y: message.cursor.y,
                userName: message.userName,
                userId: message.userId
            });
            this.redrawCanvas();
        }
    }

    wheelHandler = (e: WheelEvent) => {
        e.preventDefault();

        const now = Date.now();
        if (now - this.lastZoomTime < this.zoomThrottleMs) return;
        this.lastZoomTime = now;

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoomFactor = e.deltaY < 0 
            ? (e.ctrlKey ? 1.05 : 1.1)
            : (e.ctrlKey ? 0.95 : 0.9);

        const newZoom = Math.min(Math.max(this.camera.zoom * zoomFactor, 0.1), 20);

        this.camera.x = mouseX - (mouseX - this.camera.x) * (newZoom / this.camera.zoom);
        this.camera.y = mouseY - (mouseY - this.camera.y) * (newZoom / this.camera.zoom);
        this.camera.zoom = newZoom;

        this.redrawCanvas();
    }

    private isTypingTarget(target: EventTarget | null): boolean {
        if (!(target instanceof HTMLElement)) return false;
        return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    }

    keyDownHandler = (e: KeyboardEvent) => {
        if (this.isTypingTarget(e.target)) return;

        if ((e.key === "Delete" || e.key === "Backspace") && this.selectedId) {
            e.preventDefault();
            this.deleteSelected();
            return;
        }
        if (e.key === "Escape" && this.selectedId) {
            this.selectedId = null;
            this.redrawCanvas();
        }

        if (e.code === "Space" && !this.spacePressed) {
            this.spacePressed = true;
            this.canvas.style.cursor = "grab";
        }

        if (e.ctrlKey || e.metaKey) {
            if (e.key === "=" || e.key === "+") {
                e.preventDefault();
                this.zoomIn();
            } else if (e.key === "-") {
                e.preventDefault();
                this.zoomOut();
            } else if (e.key === "0") {
                e.preventDefault();
                this.resetView();
            } else if (e.key.toLowerCase() === "z") {
                e.preventDefault();
                if (e.shiftKey) this.redo();
                else this.undo();
            } else if (e.key.toLowerCase() === "y") {
                e.preventDefault();
                this.redo();
            }
        }
    }

    keyUpHandler = (e: KeyboardEvent) => {
        if (e.code === "Space") {
            this.spacePressed = false;
            this.canvas.style.cursor = this.getCursorForTool();
        }
    }

    private getCursorForTool(): string {
        switch (this.selectedTool) {
            case "pencil": return "crosshair";
            case "eraser": return "pointer";
            case "text": return "text";
            case "select": return "default";
            default: return "crosshair";
        }
    }

    initKeyboardHandlers() {
        window.addEventListener("keydown", this.keyDownHandler);
        window.addEventListener("keyup", this.keyUpHandler);
    }

    mouseDownHandler = (e: MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && this.spacePressed)) {
            this.isPanning = true;
            this.panStart = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = "grabbing";
            return;
        }

        if (this.selectedTool === "text") {
            return;
        }

        if (this.selectedTool === "select") {
            const worldPos = this.screenToWorld(e.clientX, e.clientY);
            const hit = hitTest(this.existingShapes, worldPos.x, worldPos.y, 8 / this.camera.zoom);
            this.selectedId = hit?.id ?? null;
            this.drag = hit ? { startX: worldPos.x, startY: worldPos.y, original: hit, moved: false } : null;
            this.redrawCanvas();
            return;
        }

        if (this.selectedTool === "eraser") {
            this.clicked = true;
            const worldPos = this.screenToWorld(e.clientX, e.clientY);
            this.handleEraser(worldPos.x, worldPos.y);
            return;
        }

        this.clicked = true;
        const worldPos = this.screenToWorld(e.clientX, e.clientY);
        this.startX = worldPos.x;
        this.startY = worldPos.y;
        
        if (this.selectedTool === "pencil") {
            this.currentPath = [{ x: worldPos.x, y: worldPos.y }];
        }
    }

    private handleEraser(x: number, y: number) {
        const threshold = 20 / this.camera.zoom;
        const hit = this.existingShapes.filter(shape => isPointNearShape(x, y, shape, threshold));
        if (hit.length === 0) return;

        // Deletes go out live while dragging; the whole stroke is one undo step.
        this.erasedThisStroke.push(...hit);
        this.applyLocal([{ op: "delete", ids: hit.map(s => s.id) }]);
    }

    mouseUpHandler = (e: MouseEvent) => {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = this.spacePressed ? "grab" : this.getCursorForTool();
            return;
        }

        if (this.selectedTool === "text") {
            return;
        }

        if (this.selectedTool === "select") {
            const drag = this.drag;
            this.drag = null;
            if (!drag) return;
            const moved = this.getSelectedShape();
            // Nothing to send if it was a plain click or someone deleted it mid-drag.
            if (!moved || !drag.moved) return;
            const update: DrawOp = { op: "update", shape: moved };
            this.sendOp(update);
            this.record([update], [{ op: "update", shape: drag.original }]);
            return;
        }

        if (this.selectedTool === "eraser") {
            if (this.erasedThisStroke.length > 0) {
                const erased = this.erasedThisStroke;
                this.erasedThisStroke = [];
                this.record(
                    [{ op: "delete", ids: erased.map(s => s.id) }],
                    erased.map(shape => ({ op: "add", shape }))
                );
            }
            this.clicked = false;
            return;
        }

        if (this.selectedTool === "pencil") {
            if (this.currentPath.length > 1) {
                this.addShape({
                    type: "pencil",
                    points: [...this.currentPath],
                    strokeColor: this.strokeColor,
                    strokeWidth: this.strokeWidth
                });
            }
            this.currentPath = [];
            this.clicked = false;
            this.redrawCanvas();
            return;
        }

        this.clicked = false;
        const worldEnd = this.screenToWorld(e.clientX, e.clientY);
        const width = worldEnd.x - this.startX;
        const height = worldEnd.y - this.startY;

        const selectedTool = this.selectedTool;
        let shape: ShapeWithoutId | null = null;
        
        if (selectedTool === "rect") {
            shape = {
                type: "rect",
                x: this.startX,
                y: this.startY,
                height,
                width,
                strokeColor: this.strokeColor,
                strokeWidth: this.strokeWidth
            }
        } else if (selectedTool === "circle") {
            const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
            shape = {
                type: "circle",
                radius: radius,
                centerX: this.startX + width / 2,
                centerY: this.startY + height / 2,
                strokeColor: this.strokeColor,
                strokeWidth: this.strokeWidth
            }
        } else if (selectedTool === "line") {
            shape = {
                type: "line",
                startX: this.startX,
                startY: this.startY,
                endX: worldEnd.x,
                endY: worldEnd.y,
                strokeColor: this.strokeColor,
                strokeWidth: this.strokeWidth
            }
        } else if (selectedTool === "arrow") {
            shape = {
                type: "arrow",
                startX: this.startX,
                startY: this.startY,
                endX: worldEnd.x,
                endY: worldEnd.y,
                strokeColor: this.strokeColor,
                strokeWidth: this.strokeWidth
            }
        }

        if (!shape) {
            return;
        }

        this.addShape(shape);
    }

    mouseMoveHandler = (e: MouseEvent) => {
        if (this.isPanning) {
            this.camera.x += e.clientX - this.panStart.x;
            this.camera.y += e.clientY - this.panStart.y;
            this.panStart = { x: e.clientX, y: e.clientY };
            this.redrawCanvas();
            return;
        }

        const worldPos = this.screenToWorld(e.clientX, e.clientY);

        const now = Date.now();
        if (now - this.lastCursorSent > this.cursorUpdateInterval && this.socket.readyState === WebSocket.OPEN) {
            this.lastCursorSent = now;
            this.socket.send(JSON.stringify({
                type: "cursor",
                roomId: this.roomId,
                cursor: { x: worldPos.x, y: worldPos.y }
            }));
        }

        if (this.selectedTool === "pencil" && this.clicked) {
            this.currentPath.push({ x: worldPos.x, y: worldPos.y });
            this.redrawCanvas();
            
            this.ctx.save();
            this.ctx.translate(this.camera.x, this.camera.y);
            this.ctx.scale(this.camera.zoom, this.camera.zoom);
            
            this.ctx.strokeStyle = this.strokeColor;
            this.ctx.lineWidth = this.strokeWidth;
            this.ctx.lineCap = "round";
            this.ctx.lineJoin = "round";
            this.ctx.beginPath();
            if (this.currentPath.length > 0) {
                this.ctx.moveTo(this.currentPath[0].x, this.currentPath[0].y);
                for (let i = 1; i < this.currentPath.length; i++) {
                    this.ctx.lineTo(this.currentPath[i].x, this.currentPath[i].y);
                }
            }
            this.ctx.stroke();
            this.ctx.restore();
            return;
        }

        if (this.selectedTool === "eraser" && this.clicked) {
            this.handleEraser(worldPos.x, worldPos.y);
            return;
        }

        if (this.selectedTool === "select") {
            if (this.drag) {
                // Move locally while dragging; the update is sent once on mouseup.
                const dx = worldPos.x - this.drag.startX;
                const dy = worldPos.y - this.drag.startY;
                if (dx === 0 && dy === 0) return;
                this.drag.moved = true;
                const moved = translateShape(this.drag.original, dx, dy);
                this.existingShapes = applyOp(this.existingShapes, { op: "update", shape: moved });
                this.redrawCanvas();
            } else {
                const hovering = hitTest(this.existingShapes, worldPos.x, worldPos.y, 8 / this.camera.zoom);
                this.canvas.style.cursor = hovering ? "move" : "default";
            }
            return;
        }

        if (this.clicked) {
            const worldEnd = this.screenToWorld(e.clientX, e.clientY);
            const width = worldEnd.x - this.startX;
            const height = worldEnd.y - this.startY;
            
            this.redrawCanvas();
            
            this.ctx.save();
            this.ctx.translate(this.camera.x, this.camera.y);
            this.ctx.scale(this.camera.zoom, this.camera.zoom);
            
            this.ctx.strokeStyle = this.strokeColor;
            this.ctx.lineWidth = this.strokeWidth;
            const selectedTool = this.selectedTool;
            
            if (selectedTool === "rect") {
                this.ctx.strokeRect(this.startX, this.startY, width, height);
            } else if (selectedTool === "circle") {
                const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
                const centerX = this.startX + width / 2;
                const centerY = this.startY + height / 2;
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, Math.abs(radius), 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.closePath();
            } else if (selectedTool === "line") {
                this.ctx.beginPath();
                this.ctx.moveTo(this.startX, this.startY);
                this.ctx.lineTo(worldEnd.x, worldEnd.y);
                this.ctx.stroke();
                this.ctx.closePath();
            } else if (selectedTool === "arrow") {
                this.drawArrow(this.startX, this.startY, worldEnd.x, worldEnd.y);
            }

            this.ctx.restore();
        }
    }

    initMouseHandlers() {
        this.canvas.addEventListener("mousedown", this.mouseDownHandler);
        this.canvas.addEventListener("mouseup", this.mouseUpHandler);
        this.canvas.addEventListener("mousemove", this.mouseMoveHandler);
        this.canvas.addEventListener("wheel", this.wheelHandler, false);
        this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    }
}