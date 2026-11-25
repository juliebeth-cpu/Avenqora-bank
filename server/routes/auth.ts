import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { signToken } from "../auth.js";

const router = Router();
const WEBSITE_ID = 10;

// Customer sign-in. Suspension is checked after credential verification but
// before a session token is issued, so the reason is disclosed only to the
// account holder and suspended customers never receive an authenticated token.
router.post("/customer/auth/login", async (req, res) => {
  try {
    const identifier = typeof req.body?.identifier === "string"
      ? req.body.identifier.trim().toLowerCase()
      : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!identifier || !password) {
      res.status(400).json({ error: "Username/email and password are required" });
      return;
    }

    const result = await pool.query(
      `SELECT id, username, email, first_name, last_name, password_hash,
              status, suspension_reason
         FROM customers
        WHERE website_id = $1
          AND (LOWER(username) = $2 OR LOWER(email) = $2)
        LIMIT 1`,
      [WEBSITE_ID, identifier],
    );

    const customer = result.rows[0];
    if (!customer?.password_hash || !(await bcrypt.compare(password, customer.password_hash))) {
      res.status(401).json({ error: "Invalid username/email or password" });
      return;
    }

    if (customer.status === "suspended") {
      res.status(403).json({
        code: "ACCOUNT_SUSPENDED",
        error: "Account Suspended",
        rejectionReason: customer.suspension_reason ?? null,
      });
      return;
    }

    const token = signToken({
      userId: Number(customer.id),
      userType: "customer",
      username: customer.username,
      websiteId: WEBSITE_ID,
    });

    res.json({
      token,
      customer: {
        id: customer.id,
        username: customer.username,
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
      },
    });
  } catch (error) {
    console.error("[customer auth] login failed", error);
    res.status(500).json({ error: "Unable to sign in right now" });
  }
});

export default router;
