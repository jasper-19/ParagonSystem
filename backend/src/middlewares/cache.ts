import { Request, Response, NextFunction } from "express";

export function publicCache(seconds: number) {
    return(_req: Request, res: Response, next: NextFunction) => {
        res.setHeader(
            "Cache-Control",
            `public, max-age=${seconds}, stale-while-revalidate=${seconds * 2}`
        );

        next();
    };
}