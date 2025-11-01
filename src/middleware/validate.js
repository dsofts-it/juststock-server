"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
function validate(schema) {
    return (req, res, next) => {
        const data = { body: req.body, query: req.query, params: req.params };
        const result = schema.safeParse(data);
        if (!result.success)
            return res.status(400).json({ error: 'validation_error', details: result.error.flatten() });
        next();
    };
}
