const { pool } = require("../config/database");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, "../uploads");
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename with timestamp
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    }
});

// File filter for images and documents
const fileFilter = (req, file, cb) => {
    // Accept images and common document types
    const allowedMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
        "image/bmp",
        "image/tiff",
        "image/x-icon",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain"
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }
};

// Configure multer upload
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit per file
    }
});

/**
 * Submit project data controller
 * Handles form data including text fields and file uploads
 */
const projectSubmissionController = async (req, res) => {
    try {
        const { projectId, projectName, customerId, customerName, customerContact, formData, fieldLabels, fieldTypes } = req.body;

        // Parse formData if it's a string
        let parsedFormData = formData;
        if (typeof formData === "string") {
            parsedFormData = JSON.parse(formData);
        }

        // Parse fieldLabels if it's a string
        let parsedLabels = fieldLabels;
        if (typeof fieldLabels === "string") {
            parsedLabels = JSON.parse(fieldLabels);
        }

        // Parse fieldTypes if it's a string
        let parsedTypes = fieldTypes;
        if (typeof fieldTypes === "string") {
            parsedTypes = JSON.parse(fieldTypes);
        }

        // Process files - add file paths to form data
        const filesData = {};
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                filesData[file.fieldname] = {
                    originalName: file.originalname,
                    filename: file.filename,
                    path: `/uploads/${file.filename}`,
                    mimetype: file.mimetype,
                    size: file.size
                };
            });
        }

        // Merge text data and file data
        const completeFormData = { ...parsedFormData, ...filesData };

        // Insert into submissions table
        const [result] = await pool.execute(
            `INSERT INTO project_submissions 
            (project_id, project_name, customer_id, customer_name, customer_contact, form_data, field_labels, field_types, submitted_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                projectId,
                projectName,
                customerId || null,
                customerName || null,
                customerContact ? customerContact.trim() : null,
                JSON.stringify(completeFormData),
                JSON.stringify(parsedLabels),
                JSON.stringify(parsedTypes),
            ]
        );

        console.log("✅ Submission saved:", result.insertId);
        
        // Sync to customer_login table for fast retrieval in main list
        await pool.execute(
            `UPDATE customer_login 
             SET last_update = NOW(), last_project = ?, last_status = 'Pending' 
             WHERE contact = ?`,
            [projectName, customerContact]
        );

        res.status(200).json({
            message: "success",
            submissionId: result.insertId,
            data: {
                projectId,
                projectName,
                formData: completeFormData
            }
        });

    } catch (error) {
        console.error("❌ Submission error:", error);
        res.status(500).json({
            message: "Failed to submit project data",
            error: error.message
        });
    }
};

/**
 * Get all submissions for a project
 */
const getProjectSubmissionsController = async (req, res) => {
    try {
        const { projectId } = req.params;

        const [rows] = await pool.execute(
            "SELECT * FROM project_submissions WHERE project_id = ? ORDER BY submitted_at DESC",
            [projectId]
        );

        res.status(200).json({
            message: "success",
            submissions: rows
        });

    } catch (error) {
        console.error("❌ Error fetching submissions:", error);
        res.status(500).json({
            message: "Failed to fetch submissions",
            error: error.message
        });
    }
};

/**
 * Get a single submission by ID
 */
const getSubmissionByIdController = async (req, res) => {
    try {
        const { submissionId } = req.params;

        const [rows] = await pool.execute(
            "SELECT * FROM project_submissions WHERE id = ?",
            [submissionId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Submission not found" });
        }

        res.status(200).json({
            message: "success",
            submission: rows[0]
        });

    } catch (error) {
        console.error("❌ Error fetching submission:", error);
        res.status(500).json({
            message: "Failed to fetch submission",
            error: error.message
        });
    }
};

/**
 * Update submission status (e.g., pending to completed)
 */
const updateSubmissionStatusController = async (req, res) => {
    try {
        const { submissionId, status } = req.body;

        if (!submissionId || !status) {
            return res.status(400).json({ message: "Submission ID and status are required" });
        }

        const [result] = await pool.execute(
            "UPDATE project_submissions SET status = ?, submitted_at = NOW() WHERE id = ?",
            [status, submissionId]
        );

        // Sync the status change to the customer_login table as well
        if (result.affectedRows > 0) {
            await pool.execute(
                `UPDATE customer_login c
                 JOIN project_submissions s ON s.customer_contact = c.contact
                 SET c.last_update = NOW(), c.last_status = ?
                 WHERE s.id = ?`,
                [status, submissionId]
            );
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Submission not found" });
        }

        console.log(`✅ Submission ${submissionId} status updated to: ${status}`);

        res.status(200).json({
            message: "success",
            submissionId,
            status
        });

    } catch (error) {
        console.error("❌ Error updating submission status:", error);
        res.status(500).json({
            message: "Failed to update submission status",
            error: error.message
        });
    }
};

/**
 * Get all submissions for a customer by contact number
 */
const getCustomerSubmissionsController = async (req, res) => {
    try {
        const { customerContact } = req.params;

        if (!customerContact) {
            return res.status(400).json({ message: "Customer contact is required" });
        }

        const [rows] = await pool.execute(
            "SELECT * FROM project_submissions WHERE customer_contact = ? ORDER BY submitted_at DESC",
            [customerContact]
        );

        res.status(200).json({
            message: "success",
            submissions: rows
        });

    } catch (error) {
        console.error("❌ Error fetching customer submissions:", error);
        res.status(500).json({
            message: "Failed to fetch customer submissions",
            error: error.message
        });
    }
};

// Export multer upload middleware and controllers
module.exports = {
    upload,
    projectSubmissionController,
    getProjectSubmissionsController,
    getSubmissionByIdController,
    updateSubmissionStatusController,
    getCustomerSubmissionsController
};
