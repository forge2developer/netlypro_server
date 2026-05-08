const { pool } = require("../config/database");

const createGroupController = async (req, res) => {
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ message: "Group name is required" });
    }

    try {
        const [result] = await pool.execute(
            "INSERT INTO project_groups (name) VALUES (?)",
            [name]
        );

        res.status(200).json({
            message: "Group created successfully",
            groupId: result.insertId,
            name: name
        });
    } catch (error) {
        console.error("Create group error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getGroupsController = async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT * FROM project_groups ORDER BY created_at DESC");
        res.status(200).json({ message: "success", groups: rows });
    } catch (error) {
        console.error("Get groups error:", error);
        res.status(500).json({ message: error });
    }
};

const updateGroupController = async (req, res) => {
    const { id, name } = req.body;
    console.log("=== Update Group Request ===");
    console.log("ID:", id);
    console.log("Name:", name);

    if (!id || !name) {
        return res.status(400).json({ message: "Group ID and new name are required" });
    }

    try {
        console.log("Executing SQL: UPDATE project_groups SET name = ? WHERE id = ?", [name, id]);
        console.log("ID Type:", typeof id);
        
        const [result] = await pool.execute(
            "UPDATE project_groups SET name = ? WHERE id = ?",
            [name, id]
        );
        console.log("Update result object:", result);
        
        if (result.affectedRows === 0) {
            console.log("Update failed: No rows affected. Check if ID exists.");
            return res.status(404).json({ message: "Group not found or no name change" });
        }
        
        res.status(200).json({ message: "Group updated successfully" });
    } catch (error) {
        console.error("Update group error details:", error);
        res.status(500).json({ message: error.message || "Internal server error" });
    }
};

module.exports = { createGroupController, getGroupsController, updateGroupController };
