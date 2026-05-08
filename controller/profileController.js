const { pool } = require("../config/database");
const bcrypt = require("bcrypt");

const getUserController = async (req, res) => {
    const { companyName } = req.body;
    //console.log("Request body:", companyName);

    if (!companyName) {
        return res.status(400).json({ message: "Company is required" });
    }

    try {
        const [rows] = await pool.execute(
            "SELECT * FROM users where company = ?",
            [companyName]
        );
        console.log(rows);

        res.status(200).json({ message: "success", table: rows });
    } catch (error) {
        res.status(500).json({ message: error });
    }
};

const addUserController = async (req, res) => {
    const { name, email, password, role, company } = req.body;
    console.log("Request body:", req.body);
    if (!name || !email || !password || !role || !company) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const [rows] = await pool.execute(
            "INSERT INTO users (name, email, password, role, company) VALUES (?, ?, ?, ?, ?)",
            [name, email, hashedPassword, role, company]
        );
        console.log(rows);
        res.status(200).json({ message: "success", user: rows[0] });
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const addCustomerController = async (req, res) => {
    const { name, phone } = req.body;
    console.log("Customer Login Attempt:", { name, phone });
    
    if (!name || !phone) {
        return res.status(400).json({ message: "Name and phone number are required" });
    }

    try {
        // Step 1: Check if the phone number already exists
        const [existing] = await pool.execute(
            "SELECT * FROM customer_login WHERE contact = ?",
            [phone]
        );

        if (existing.length > 0) {
            const storedName = existing[0].name;
            // Step 2 & 3: Match name with existing number
            if (storedName.toLowerCase() !== name.toLowerCase()) {
                console.log(`Name mismatch for ${phone}: ${name} vs ${storedName}`);
                return res.status(400).json({ 
                    message: "This phone number is already registered with a different name. Please check your details." 
                });
            }
            
            // Name matches existant record, proceed to login
            console.log("Existing customer logged in:", existing[0]);
            return res.status(200).json({ message: "success", user: existing[0] });
        }

        // Step 4: Add new customer if number doesn't exist
        const [rows] = await pool.execute(
            "INSERT INTO customer_login (name, contact) VALUES (?, ?)",
            [name, phone]
        );
        console.log("New customer created:", rows.insertId);
        res.status(200).json({ 
            message: "success", 
            user: { id: rows.insertId, name, contact: phone } 
        });
    } catch (error) {
        console.error("Error during customer login logic:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getCustomersController = async (req, res) => {
    try {
        // Step 1: Universal Column Check (Works on all MySQL/MariaDB versions)
        try {
            const [columns] = await pool.query("SHOW COLUMNS FROM customer_login");
            const columnNames = columns.map(c => c.Field);
            
            if (!columnNames.includes('last_update')) {
                await pool.query("ALTER TABLE customer_login ADD COLUMN last_update DATETIME DEFAULT NULL");
            }
            if (!columnNames.includes('last_project')) {
                await pool.query("ALTER TABLE customer_login ADD COLUMN last_project VARCHAR(255) DEFAULT NULL");
            }
            if (!columnNames.includes('last_status')) {
                await pool.query("ALTER TABLE customer_login ADD COLUMN last_status VARCHAR(50) DEFAULT NULL");
            }

            // Step 2: Robust Data Migration (Sync from submissions history)
            await pool.query(`
                UPDATE customer_login c
                SET 
                    c.last_update = (SELECT MAX(submitted_at) FROM project_submissions WHERE REPLACE(customer_contact, ' ', '') = REPLACE(c.contact, ' ', '')),
                    c.last_project = (SELECT project_name FROM project_submissions WHERE REPLACE(customer_contact, ' ', '') = REPLACE(c.contact, ' ', '') ORDER BY submitted_at DESC LIMIT 1),
                    c.last_status = (SELECT status FROM project_submissions WHERE REPLACE(customer_contact, ' ', '') = REPLACE(c.contact, ' ', '') ORDER BY submitted_at DESC LIMIT 1)
                WHERE c.last_update IS NULL 
                AND EXISTS (SELECT 1 FROM project_submissions WHERE REPLACE(customer_contact, ' ', '') = REPLACE(c.contact, ' ', ''))
            `);
        } catch (e) {
            console.log("Database bridge log:", e.message);
        }

        const [rows] = await pool.query(`
            SELECT 
                c.id, c.name, c.contact, c.createdAt,
                c.last_update as lastUpdateDate,
                c.last_project as lastProjectName,
                c.last_status as lastStatus,
                (SELECT COUNT(*) FROM project_submissions p WHERE REPLACE(p.customer_contact, ' ', '') = REPLACE(c.contact, ' ', '')) as total_submitted,
                (SELECT COUNT(*) FROM project_submissions p WHERE REPLACE(p.customer_contact, ' ', '') = REPLACE(c.contact, ' ', '') AND p.status = 'Completed') as total_completed
            FROM customer_login c
            ORDER BY c.id DESC
        `);
        
        res.status(200).json({ message: "success", customers: rows });
    } catch (error) {
        console.error("Error fetching customers:", error.message);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

const deleteUserController = async (req, res) => {
    const { userId, company } = req.body;

    if (!userId || !company) {
        return res.status(400).json({ message: "User ID and company are required" });
    }

    try {
        // Get user details before deletion
        const [userRows] = await pool.execute(
            "SELECT * FROM users WHERE id = ? AND company = ?",
            [userId, company]
        );

        if (!userRows || userRows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const userToDelete = userRows[0];

        // Step 2 & 3: Admin only delete the staff, can't delete another admin
        if (userToDelete.role.toLowerCase() === "admin") {
            return res.status(403).json({ 
                success: false,
                message: "Security Protocol: Administrators cannot be deleted from this interface." 
            });
        }

        if (userToDelete.role.toLowerCase() !== "staff") {
            return res.status(403).json({ 
                success: false,
                message: "Only staff members can be deleted." 
            });
        }

        // Delete the user
        const [result] = await pool.execute(
            "DELETE FROM users WHERE id = ? AND company = ?",
            [userId, company]
        );

        if (result.affectedRows > 0) {
            console.log(`Staff member ${userId} deleted successfully`);
            res.status(200).json({ 
                success: true,
                message: "User deleted successfully" 
            });
        } else {
            res.status(404).json({ success: false, message: "Failed to delete user" });
        }
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = { getUserController, addUserController, addCustomerController, getCustomersController, deleteUserController };