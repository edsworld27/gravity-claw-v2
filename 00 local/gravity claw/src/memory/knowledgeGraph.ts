import { db } from '../db/index.js';

export interface Triplet {
    subject: string;
    predicate: string;
    object: string;
}

export class KnowledgeGraph {
    public static saveTriplet(subject: string, predicate: string, object: string): void {
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO knowledge_graph (subject, predicate, object) 
            VALUES (?, ?, ?)
        `);
        stmt.run(subject.toLowerCase(), predicate.toLowerCase(), object.toLowerCase());
    }

    public static query(query: string): Triplet[] {
        // Simple entity search: find any triplets where the query matches subject or object
        const stmt = db.prepare(`
            SELECT subject, predicate, object FROM knowledge_graph 
            WHERE subject LIKE ? OR object LIKE ? OR predicate LIKE ?
        `);
        const search = `%${query.toLowerCase()}%`;
        return stmt.all(search, search, search) as Triplet[];
    }

    public static deleteEntity(entity: string): void {
        const stmt = db.prepare(`
            DELETE FROM knowledge_graph 
            WHERE subject = ? OR object = ?
        `);
        stmt.run(entity.toLowerCase(), entity.toLowerCase());
    }
}
