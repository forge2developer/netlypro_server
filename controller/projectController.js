const { pool } = require("../config/database");

const projectInsertController = async (req, res) => {
    const { projectName, fields, groupId } = req.body;

    try {
        // extract arrays
        const labels = fields.map(f => f.label);
        const inputs = fields.map(f => f.type);
        // Store options for dropdown fields (null for non-dropdown fields)
        const options = fields.map(f => f.type === 'dropdown' ? f.options : null);
        // Store formulas for formula fields (null for non-formula fields)
        const formulas = fields.map(f => f.type === 'formula' ? f.formula : null);

        // Debug logging
        console.log("=== Project Insert Debug ===");
        console.log("Fields received:", JSON.stringify(fields, null, 2));
        console.log("Extracted formulas:", formulas);
        console.log("Extracted options:", options);
        console.log("Group ID:", groupId);

        const [result] = await pool.execute(
            "INSERT INTO projects (name, label, inputs, options, formulas, field, status, group_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
                projectName,
                JSON.stringify(labels),
                JSON.stringify(inputs),
                JSON.stringify(options),
                JSON.stringify(formulas),
                fields.length,
                "hold",
                groupId || null
            ]
        );

        res.status(200).json({
            message: "success",
            projectId: result.insertId
        });

    } catch (error) {
        console.error("Insert error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
const getProjectsController = async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT p.*, pg.name as group_name 
            FROM projects p 
            LEFT JOIN project_groups pg ON p.group_id = pg.id 
            WHERE p.status = 'Active'
        `);
        console.log("projectShowcase", rows);
        res.status(200).json({ message: "success", table: rows });
    } catch (error) {
        console.error("Error during get projects:", error);
        res.status(500).json({ message: error });
    }
};

const projectShowcaseController = async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT p.*, pg.name as group_name,
            (SELECT COUNT(*) FROM project_submissions ps WHERE ps.project_id = p.id) as total_submitted
            FROM projects p 
            LEFT JOIN project_groups pg ON p.group_id = pg.id
        `);
        console.log("projectShowcase", rows);
        res.status(200).json({ message: "success", table: rows });
    } catch (error) {
        console.error("Error during project showcase:", error);
        res.status(500).json({ message: error });
    }
};

const updateProjectStatusController = async (req, res) => {
    try {
        const [rows] = await pool.execute("UPDATE projects SET status = ? WHERE id = ?", [req.body.status, req.body.id]);
        console.log("update", rows);
        res.status(200).json({ message: "success" });
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ message: error });
    }
};

const updateProjectGroupController = async (req, res) => {
    try {
        const { projectId, groupId } = req.body;
        // groupId can be null if set to "Nil"
        const [rows] = await pool.execute("UPDATE projects SET group_id = ? WHERE id = ?", [groupId, projectId]);
        console.log("Project group updated:", rows);
        res.status(200).json({ message: "success" });
    } catch (error) {
        console.error("Error updating project group:", error);
        res.status(500).json({ message: error });
    }
};
const deleteProjectController = async (req, res) => {
    try {
        const [rows] = await pool.execute("DELETE FROM projects WHERE id = ?", [req.body.id]);
        console.log("Project deleted:", rows);
        res.status(200).json({ message: "success" });
    } catch (error) {
        console.error("Error deleting project:", error);
        res.status(500).json({ message: error });
    }
};
const updateProjectController = async (req, res) => {
    const { id, projectName, fields, groupId } = req.body;

    // Guard: must have id and projectName
    if (!id || !projectName) {
        return res.status(400).json({ message: "Missing required fields: id or projectName" });
    }
    if (!Array.isArray(fields)) {
        return res.status(400).json({ message: "fields must be an array" });
    }

    try {
        // Safely extract arrays with fallbacks
        const labels = fields.map(f => f.label || '');
        const inputs = fields.map(f => f.type || 'text');
        const options = fields.map(f => (f.type === 'dropdown' && f.options) ? f.options : null);
        const formulas = fields.map(f => (f.type === 'formula' && f.formula) ? String(f.formula).trim() : null);

        console.log("=== Project Update Debug ===");
        console.log("Project ID:", id);
        console.log("Project Name:", projectName);
        console.log("Labels:", labels);
        console.log("Inputs:", inputs);
        console.log("Options:", options);
        console.log("Formulas:", formulas);
        console.log("Group ID:", groupId);

        const [result] = await pool.execute(
            "UPDATE projects SET name = ?, label = ?, inputs = ?, options = ?, formulas = ?, field = ?, group_id = ? WHERE id = ?",
            [
                projectName,
                JSON.stringify(labels),
                JSON.stringify(inputs),
                JSON.stringify(options),
                JSON.stringify(formulas),
                fields.length,
                groupId || null,
                id
            ]
        );

        console.log("Affected rows:", result.affectedRows);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: `Project with id ${id} not found` });
        }

        res.status(200).json({ message: "success" });

    } catch (error) {
        console.error("=== Update Project Error ===");
        console.error("Error message:", error.message);
        console.error("Error code:", error.code);
        console.error("Full error:", error);
        res.status(500).json({ message: error.message || "Internal server error" });
    }
};

module.exports = { getProjectsController, projectInsertController, projectShowcaseController, updateProjectStatusController, updateProjectGroupController, deleteProjectController, updateProjectController };