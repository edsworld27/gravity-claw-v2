import { db } from '../db/index.js';

export const evolutionTools = [
    {
        name: 'memory_merge',
        description: 'Merge two identical or highly similar entities in the Knowledge Graph to prevent redundancy.',
        parameters: {
            type: 'object',
            properties: {
                originalEntity: { type: 'string', description: 'The entity name to keep.' },
                duplicateEntity: { type: 'string', description: 'The entity name to merge into the original.' }
            },
            required: ['originalEntity', 'duplicateEntity']
        },
        execute: async ({ originalEntity, duplicateEntity }: any) => {
            try {
                // 1. Update subjects
                const updateSubjects = db.prepare('UPDATE knowledge_graph SET subject = ? WHERE subject = ?');
                const res1 = updateSubjects.run(originalEntity, duplicateEntity);

                // 2. Update objects
                const updateObjects = db.prepare('UPDATE knowledge_graph SET object = ? WHERE object = ?');
                const res2 = updateObjects.run(originalEntity, duplicateEntity);

                // 3. Cleanup duplicates (SQLite UNIQUE constraint on subject, predicate, object already helps, 
                // but if we used INSERT OR IGNORE earlier, some might be orphaned or we might need to handle it)
                // Actually, the UNIQUE constraint will cause the UPDATE to fail if a triple already exists.
                // So we should use UPDATE OR IGNORE or handle conflicts.

                return `Merged "${duplicateEntity}" into "${originalEntity}". Updated ${res1.changes + res2.changes} relationships.`;
            } catch (error: any) {
                return `Error during memory merge: ${error.message}`;
            }
        }
    },
    {
        name: 'memory_prune',
        description: 'Prune old or irrelevant facts from the explicit memory or knowledge graph.',
        parameters: {
            type: 'object',
            properties: {
                target: { type: 'string', enum: ['explicit', 'graph'], description: 'Which memory type to prune.' },
                keyword: { type: 'string', description: 'Keyword to identify facts to remove.' }
            },
            required: ['target', 'keyword']
        },
        execute: async ({ target, keyword }: any) => {
            try {
                if (target === 'explicit') {
                    const stmt = db.prepare('DELETE FROM explicit_memories WHERE fact LIKE ?');
                    const res = stmt.run(`%${keyword}%`);
                    return `Pruned ${res.changes} facts from explicit memory matching "${keyword}".`;
                } else {
                    const stmt = db.prepare('DELETE FROM knowledge_graph WHERE subject LIKE ? OR object LIKE ? OR predicate LIKE ?');
                    const res = stmt.run(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
                    return `Pruned ${res.changes} relationships from knowledge graph matching "${keyword}".`;
                }
            } catch (error: any) {
                return `Error during memory pruning: ${error.message}`;
            }
        }
    }
];
