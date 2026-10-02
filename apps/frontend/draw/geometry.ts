import { Shape } from "./shapes";

export interface Bounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

/** Rough text width; avoids needing a canvas context for hit testing. */
export function estimateTextWidth(text: string, fontSize: number): number {
    return text.length * fontSize * 0.6;
}

export function pointToLineDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const C = x2 - x1;
    const D = y2 - y1;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = ((px - x1) * C + (py - y1) * D) / lenSq;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else { xx = x1 + param * C; yy = y1 + param * D; }
    return Math.sqrt((px - xx) ** 2 + (py - yy) ** 2);
}

export function getBounds(shape: Shape): Bounds {
    switch (shape.type) {
        case "rect":
            return {
                minX: Math.min(shape.x, shape.x + shape.width),
                minY: Math.min(shape.y, shape.y + shape.height),
                maxX: Math.max(shape.x, shape.x + shape.width),
                maxY: Math.max(shape.y, shape.y + shape.height),
            };
        case "circle": {
            const r = Math.abs(shape.radius);
            return { minX: shape.centerX - r, minY: shape.centerY - r, maxX: shape.centerX + r, maxY: shape.centerY + r };
        }
        case "line":
        case "arrow":
            return {
                minX: Math.min(shape.startX, shape.endX),
                minY: Math.min(shape.startY, shape.endY),
                maxX: Math.max(shape.startX, shape.endX),
                maxY: Math.max(shape.startY, shape.endY),
            };
        case "pencil": {
            const xs = shape.points.map((p) => p.x);
            const ys = shape.points.map((p) => p.y);
            return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
        }
        case "text":
            // Text is drawn with its baseline at y.
            return {
                minX: shape.x,
                minY: shape.y - shape.fontSize,
                maxX: shape.x + estimateTextWidth(shape.text, shape.fontSize),
                maxY: shape.y,
            };
    }
}

export function unionBounds(shapes: Shape[]): Bounds | null {
    if (shapes.length === 0) return null;
    return shapes.map(getBounds).reduce((a, b) => ({
        minX: Math.min(a.minX, b.minX),
        minY: Math.min(a.minY, b.minY),
        maxX: Math.max(a.maxX, b.maxX),
        maxY: Math.max(a.maxY, b.maxY),
    }));
}

export function isPointNearShape(x: number, y: number, shape: Shape, threshold: number): boolean {
    switch (shape.type) {
        case "rect":
        case "text": {
            const b = getBounds(shape);
            return x >= b.minX - threshold && x <= b.maxX + threshold &&
                   y >= b.minY - threshold && y <= b.maxY + threshold;
        }
        case "circle": {
            const dist = Math.sqrt((x - shape.centerX) ** 2 + (y - shape.centerY) ** 2);
            return Math.abs(dist - Math.abs(shape.radius)) <= threshold;
        }
        case "line":
        case "arrow":
            return pointToLineDistance(x, y, shape.startX, shape.startY, shape.endX, shape.endY) <= threshold;
        case "pencil": {
            const pts = shape.points;
            if (pts.length === 1) {
                return Math.hypot(x - pts[0]!.x, y - pts[0]!.y) <= threshold;
            }
            for (let i = 0; i < pts.length - 1; i++) {
                if (pointToLineDistance(x, y, pts[i]!.x, pts[i]!.y, pts[i + 1]!.x, pts[i + 1]!.y) <= threshold) {
                    return true;
                }
            }
            return false;
        }
    }
}

/** Topmost shape under the point, i.e. the last one drawn. */
export function hitTest(shapes: Shape[], x: number, y: number, threshold: number): Shape | null {
    for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i]!;
        if (isPointNearShape(x, y, shape, threshold)) return shape;
    }
    return null;
}

export function translateShape(shape: Shape, dx: number, dy: number): Shape {
    switch (shape.type) {
        case "rect":
        case "text":
            return { ...shape, x: shape.x + dx, y: shape.y + dy };
        case "circle":
            return { ...shape, centerX: shape.centerX + dx, centerY: shape.centerY + dy };
        case "line":
        case "arrow":
            return {
                ...shape,
                startX: shape.startX + dx,
                startY: shape.startY + dy,
                endX: shape.endX + dx,
                endY: shape.endY + dy,
            };
        case "pencil":
            return { ...shape, points: shape.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
    }
}
