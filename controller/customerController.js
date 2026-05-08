const { pool } = require("../config/database");

const CustomerLoginController = async (req, res) => {
    console.log("Customer login request:", req.body);

    const { name, phone } = req.body;

    if (!name || !phone) {
        return res.status(400).json({
            success: false,
            message: "Name and phone are required",
        });
    }

    try {
        // Step 1: Check if customer already exists by phone number
        const [rows] = await pool.execute(
            "SELECT id, name, contact FROM customer_login WHERE contact = ? LIMIT 1",
            [phone]
        );

        if (rows.length > 0) {
            const storedName = rows[0].name;
            // Step 2 & 3: Match name with existing record
            if (storedName.toLowerCase() !== name.toLowerCase()) {
                console.log(`Name mismatch for ${phone}: ${name} vs ${storedName}`);
                return res.status(400).json({
                    success: false,
                    message: "Please check your details.",
                });
            }

            // Name matches, login successful
            return res.status(200).json({
                success: true,
                message: "Login successful",
                user: rows[0],
            });
        }

        // Step 4: If not exists → create new customer
        const [result] = await pool.execute(
            "INSERT INTO customer_login (name, contact) VALUES (?, ?)",
            [name, phone]
        );

        return res.status(201).json({
            success: true,
            message: "Customer created successfully",
            user: {
                id: result.insertId,
                name,
                contact: phone,
            },
        });
    } catch (error) {
        console.error("Customer login error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

module.exports = { CustomerLoginController };

