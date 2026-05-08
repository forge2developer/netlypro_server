const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

const { pool, testConnection } = require("./config/database"); // ✅ import db
const { loginController } = require("./controller/loginController");
const { projectInsertController, updateProjectController } = require("./controller/projectController");
const { projectShowcaseController } = require("./controller/projectController");
const { updateProjectStatusController } = require("./controller/projectController");
const { updateProjectGroupController } = require("./controller/projectController");
const { deleteProjectController } = require("./controller/projectController");
const { getUserController, addUserController, addCustomerController, getCustomersController, deleteUserController } = require("./controller/profileController");
const { CustomerLoginController } = require("./controller/customerController");
const { getProjectsController } = require("./controller/projectController");
const { upload, projectSubmissionController, getProjectSubmissionsController, getSubmissionByIdController, updateSubmissionStatusController, getCustomerSubmissionsController } = require("./controller/submissionController");
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// Routes
app.post("/", (req, res) => {
  res.send("Hello World!");
});
app.post("/login", loginController);

app.post("/customerLogin", CustomerLoginController);

app.get("/getProjects", getProjectsController);
app.post("/projectInsert", projectInsertController);
app.post("/updateProject", updateProjectController);
app.get("/projectShowcase", projectShowcaseController);
app.post("/updateProjectStatus", updateProjectStatusController);
app.post("/updateProjectGroup", updateProjectGroupController);
app.post("/deleteProject", deleteProjectController);

app.post("/getUsers", getUserController);
app.post("/addUser", addUserController);
app.post("/deleteUser", deleteUserController);
app.post("/addCustomer", addCustomerController);
app.get("/getCustomers", getCustomersController);

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Project submission routes (with file upload support)
app.post("/projectSubmission", upload.any(), projectSubmissionController);
app.get("/getSubmissions/:projectId", getProjectSubmissionsController);
app.get("/getSubmission/:submissionId", getSubmissionByIdController);
app.post("/updateSubmissionStatus", updateSubmissionStatusController);
app.get("/getCustomerSubmissions/:customerContact", getCustomerSubmissionsController);

// Group routes
const { createGroupController, getGroupsController, updateGroupController } = require("./controller/groupController");
app.post("/createGroup", createGroupController);
app.get("/getGroups", getGroupsController);
app.post("/updateGroup", updateGroupController);




// Start server
const startServer = async () => {
  await testConnection();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
};

startServer();

module.exports = { app };
