import { Tool } from "@/components/Canvas";
import { getExistingShapes } from "./http";

export type Shape = {
    type: "rect";
    x: number;
    y: number;
    width: number;
    height: number;
    strokeColor: string;
    strokeWidth: number;
} | {
    type: "circle";
    centerX: number;
    centerY: number;
    radius: number;
    strokeColor: string;
    strokeWidth: number;
} | {
    type: "pencil";
    points: { x: number; y: number }[];
    strokeColor: string;
    strokeWidth: number;
} | {
    type: "line";
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    strokeColor: string;
    strokeWidth: number;
} | {
    type: "arrow";
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    strokeColor: string;
    strokeWidth: number;
};

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
    private history: Shape[][] = [];
    private historyIndex = -1;
    private roomId: string;
    private clicked: boolean;
    private startX = 0;
    private startY = 0;
    private selectedTool: Tool = "circle";
    public strokeColor: string = "#ffffff";
    public strokeWidth: number = 2;
    private currentPath: { x: number; y: number }[] = [];
    private cursors: Map<string, Cursor> = new Map();
    private users: UserPresence[] = [];
    private lastCursorSent = 0;
    private cursorUpdateInterval = 50;
    private erasing: boolean = false;

    private camera: Camera = { x: 0, y: 0, zoom: 1 };
    private isPanning: boolean = false;
    private panStart: { x: number; y: number } = { x: 0, y: 0 };
    private spacePressed: boolean = false;

    socket: WebSocket;

    constructor(canvas: HTMLCanvasElement, roomId: string, socket: WebSocket) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d")!;
        this.existingShapes = [];
        this.roomId = roomId;
        this.socket = socket;
        this.clicked = false;
        this.init();
        this.initHandlers();
        this.initMouseHandlers();
        this.initKeyboardHandlers();
    }

    destroy() {
        this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
        this.canvas.removeEventListener("mouseup", this.mouseUpHandler);
        this.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
        this.canvas.removeEventListener("wheel", this.wheelHandler, { passive: false });
        window.removeEventListener("keydown", this.keyDownHandler);
        window.removeEventListener("keyup", this.keyUpHandler);
    }

    setTool(tool: "circle" | "pencil" | "rect" | "line" | "arrow" | "eraser") {
        this.selectedTool = tool;
    }

    setStrokeColor(color: string) {
        this.strokeColor = color;
    }

    setStrokeWidth(width: number) {
        this.strokeWidth = width;
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
        if (this.historyIndex >= 0) {
            this.historyIndex--;
            this.existingShapes = this.historyIndex >= 0 
                ? [...this.history[this.historyIndex]] 
                : [];
            this.redrawCanvas();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.existingShapes = [...this.history[this.historyIndex]];
            this.redrawCanvas();
        }
    }

    canUndo(): boolean {
        return this.historyIndex >= 0;
    }

    canRedo(): boolean {
        return this.historyIndex < this.history.length - 1;
    }

    getUsers(): UserPresence[] {
        return this.users;
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

        this.existingShapes.forEach((shape) => {
            this.drawShape(shape);
        });

        this.ctx.restore();

        this.drawCursors();
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

    private saveToHistory() {
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push([...this.existingShapes]);
        this.historyIndex++;
    }

    private drawShape(shape: Shape) {
        this.ctx.strokeStyle = shape.strokeColor;
        this.ctx.lineWidth = shape.strokeWidth;
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";

        if (shape.type === "rect") {
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

    async init() {
        this.existingShapes = await getExistingShapes(this.roomId);
        this.history = [[...this.existingShapes]];
        this.historyIndex = 0;
        this.redrawCanvas();
    }

    initHandlers() {
        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.type == "chat") {
                const parsedShape = JSON.parse(message.message)
                this.existingShapes.push(parsedShape.shape)
                this.saveToHistory();
                this.redrawCanvas();
            } else if (message.type === "cursor") {
                this.cursors.set(message.userId, {
                    x: message.cursor.x,
                    y: message.cursor.y,
                    userName: message.userName,
                    userId: message.userId
                });
                this.redrawCanvas();
            } else if (message.type === "presence") {
                this.users = message.users || [];
                this.redrawCanvas();
            }
        }
    }

    wheelHandler = (e: WheelEvent) => {
        e.preventDefault();

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

    keyDownHandler = (e: KeyboardEvent) => {
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
        const beforeCount = this.existingShapes.length;

        this.existingShapes = this.existingShapes.filter(shape => {
            if (this.isPointNearShape(x, y, shape, threshold)) {
                return false;
            }
            return true;
        });

        if (this.existingShapes.length !== beforeCount) {
            this.erasing = true;
            this.redrawCanvas();
        }
    }

    private isPointNearShape(x: number, y: number, shape: Shape, threshold: number): boolean {
        if (shape.type === "rect") {
            return x >= shape.x - threshold && x <= shape.x + shape.width + threshold &&
                   y >= shape.y - threshold && y <= shape.y + shape.height + threshold;
        } else if (shape.type === "circle") {
            const dist = Math.sqrt((x - shape.centerX) ** 2 + (y - shape.centerY) ** 2);
            return Math.abs(dist - shape.radius) <= threshold;
        } else if (shape.type === "line" || shape.type === "arrow") {
            const dist = this.pointToLineDistance(x, y, shape.startX, shape.startY, shape.endX, shape.endY);
            return dist <= threshold;
        } else if (shape.type === "pencil") {
            for (let i = 0; i < shape.points.length - 1; i++) {
                const dist = this.pointToLineDistance(x, y, shape.points[i].x, shape.points[i].y, 
                    shape.points[i + 1].x, shape.points[i + 1].y);
                if (dist <= threshold) return true;
            }
        }
        return false;
    }

    private pointToLineDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;
        let xx, yy;
        if (param < 0) { xx = x1; yy = y1; }
        else if (param > 1) { xx = x2; yy = y2; }
        else { xx = x1 + param * C; yy = y1 + param * D; }
        return Math.sqrt((px - xx) ** 2 + (py - yy) ** 2);
    }

    mouseUpHandler = (e: MouseEvent) => {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = this.spacePressed ? "grab" : this.getCursorForTool();
            return;
        }

        if (this.selectedTool === "eraser") {
            if (this.erasing) {
                this.saveToHistory();
                this.erasing = false;
            }
            this.clicked = false;
            return;
        }

        if (this.selectedTool === "pencil") {
            if (this.currentPath.length > 1) {
                const shape: Shape = {
                    type: "pencil",
                    points: [...this.currentPath],
                    strokeColor: this.strokeColor,
                    strokeWidth: this.strokeWidth
                };
                this.existingShapes.push(shape);
                this.saveToHistory();
                this.socket.send(JSON.stringify({
                    type: "chat",
                    message: JSON.stringify({ shape }),
                    roomId: this.roomId
                }));
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
        let shape: Shape | null = null;
        
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

        this.existingShapes.push(shape);
        this.saveToHistory();

        this.socket.send(JSON.stringify({
            type: "chat",
            message: JSON.stringify({
                shape
            }),
            roomId: this.roomId
        }))
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
        if (now - this.lastCursorSent > this.cursorUpdateInterval) {
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
        this.canvas.addEventListener("wheel", this.wheelHandler, { passive: false });
        this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    }
}