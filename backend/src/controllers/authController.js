import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const TOKEN_MAX_AGE_MS = 3 * 60 * 60 * 1000; // 3 hours

// Valid bcrypt hash with no corresponding real password — used to equalize
// login timing between "user not found" and "wrong password" so response
// time can't be used to enumerate registered emails.
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8x/Ax9U8f7q0j2u1yQ0m8b6nB6bU1O";

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
};

const cookieOptions = {
  ...baseCookieOptions,
  maxAge: TOKEN_MAX_AGE_MS,
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    const passwordMatches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

    if (!user || !passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = jwt.sign(
      { userId: user._id, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "3h", algorithm: "HS256" },
    );

    res.cookie("token", token, cookieOptions);
    res.status(200).json({ user: { name: user.name, email: user.email } });
  } catch (error) {
    console.error("Error in login controller", error);
    res.status(500).json({ message: "Server error during login." });
  }
};

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required." });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters long." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: "An admin with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = await User.create({ name: name.trim(), email: normalizedEmail, passwordHash });

    res.status(201).json({ user: { name: admin.name, email: admin.email } });
  } catch (error) {
    console.error("Error in register controller", error);
    res.status(500).json({ message: "Server error while creating admin." });
  }
};

export const logout = (req, res) => {
  res.clearCookie("token", baseCookieOptions);
  res.status(200).json({ message: "Logged out." });
};

export const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(401).json({ message: "Account no longer exists." });
    }
    res.status(200).json({ user: { name: user.name, email: user.email } });
  } catch (error) {
    console.error("Error in me controller", error);
    res.status(500).json({ message: "Server error while fetching session." });
  }
};
