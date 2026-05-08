const { pool } = require("../config/database");

const loginController = async (req, res) => {
    console.log("\n=== LOGIN CONTROLLER CALLED ===");
    console.log("Request body:", req.body);
    const { user, password } = req.body;
    
    if (!user || !password) {
        console.log("Missing user or password");
        return res.status(400).json({ message: "Username/Email and password are required" });
    }
    
    try {
        console.log("Looking for user:", user);
        const [rows] = await pool.execute(
            "SELECT * FROM users WHERE email = ? OR name = ? LIMIT 1",
            [user, user]
        );
        
        console.log("Query returned", rows.length, "rows");
        
        if (!Array.isArray(rows) || rows.length === 0) {
            console.log("User not found");
            return res.status(401).json({ message: "Invalid username/email or password" });
        }
        
        const userRow = rows[0];
        console.log("Found user:", userRow.email);
        console.log("Stored password:", userRow.password);
        console.log("Provided password:", password);
        console.log("Match:", userRow.password === password);
        
        if (userRow.password !== password) {
            console.log("Password does not match");
            return res.status(401).json({ message: "Invalid username/email or password" });
        }
        
        console.log("Login successful!");
        const { password: _, ...userWithoutPassword } = userRow;
        
        res.status(200).json({ 
            message: "success", 
            user: userWithoutPassword 
        });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = { loginController };
