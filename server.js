const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const cors = require("cors");
const bcrypt = require("bcrypt");
const withAuth = require("./middleware");
const cookieParser = require("cookie-parser");
const path = require("path");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors());



const conn = mysql.createConnection({
  host: "boisuoy93xsqcibmhs9l-mysql.services.clever-cloud.com",
  user: "upzzc6at1hkcqflj",
  password: "BhsbwOArFWPoBjxKdrcP",
  port: 3306,
  database: "boisuoy93xsqcibmhs9l",
});

conn.connect((err) => {
  if (err) {
    console.log(err);
  } else {
    console.log("Connected to MySQL");
  }
});

app.post("/api/vacations", (req, res) => {
  const newVacation = req.body;
  const sql = `
    INSERT INTO vacations (description, destination, start_date, end_date, image_name, price)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const params = [
    newVacation.description,
    newVacation.destination,
    newVacation.start_date,
    newVacation.end_date,
    newVacation.image_name,
    newVacation.price,
  ];

  conn.query(sql, params, (err) => {
    if (err) {
      console.error("Error adding vacation:", err);
      res.status(500).json({ error: "Error adding vacation" });
    } else {
      res.status(201).send("Vacation added successfully");
    }
  });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "front", "src", "images"));
  },
  filename: (req, file, cb) => {
    const originalFilename = path.parse(file.originalname).name;
    cb(
      null,
      originalFilename + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: storage });

app.post("/api/uploadImage", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const imagePath = req.file.filename;
  res.status(200).json({ imageName: imagePath });
});

app.get("/api/checkImageExists/:imageName", (req, res) => {
  const imageName = req.params.imageName;
  const imagePath = path.join(
    __dirname,
    "..",
    "front",
    "src",
    "images",
    imageName
  );
  fs.access(imagePath, fs.constants.F_OK, (err) => {
    if (err) {
      res.status(200).json({ exists: false });
    } else {
      res.status(200).json({ exists: true });
    }
  });
});

app.get("/api/userData", withAuth, (req, res) => {
  const userEmail = req.email;
  const sql = `
    SELECT first_name, last_name
    FROM users
    WHERE email = ?
  `;

  conn.query(sql, [userEmail], (err, result) => {
    if (err) {
      console.error("Error fetching user data:", err);
      res.status(500).json({ error: "Error fetching user data" });
    } else if (result.length > 0) {
      res.status(200).json(result[0]);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });
});

app.post('/api/register', async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  try {
    // Check if the email already exists in the database
    const emailResults = await conn.query('SELECT id FROM users WHERE email = ?', [email]);

    if (emailResults.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash the password securely
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the user's information into the database
    const result = await conn.query(
      'INSERT INTO users (email, password, first_name, last_name) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, firstName, lastName]
    );

    console.log(result);

    return res.status(200).json({ message: "Thanks for registering" });
  } catch (err) {
    console.error("Error registering user:", err);
    return res.status(500).json({ error: "Error registering user" });
  }
});

app.post("/api/login", function (req, res) {
  const { email, password } = req.body;

  conn.query(`SELECT * FROM users WHERE email="${email}"`, (err, result) => {
    if (err) {
      console.error("Error fetching user:", err);
      res.status(500).json({ error: "Error fetching user" });
    } else if (result.length > 0) {
      bcrypt.compare(password, result[0].password, function (err, same) {
        if (err) {
          console.error("Error comparing passwords:", err);
          res.status(500).json({ error: "Error comparing passwords" });
        } else if (same) {
          const payload = { email };

          const sql = `SELECT role FROM users WHERE email="${email}"`;
          conn.query(sql, (err, roleResults) => {
            if (err) {
              console.error("Error fetching user role:", err);
              res.status(500).json({ error: "Error fetching user role" });
            } else if (roleResults.length > 0) {
              const userRole = roleResults[0].role;

              payload.role = userRole;
              const token = jwt.sign(payload, "ShhItsSecret", {
                expiresIn: "2hr",
              });

              res.status(200).json({
                status: 200,
                jwt: token,
              });
            } else {
              res.status(401).send("Bad credentials");
            }
          });
        } else {
          res.status(401).send({
            status: 401,
          });
        }
      });
    } else {
      res.status(401).send("Bad credentials");
    }
  });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("token");
  res.status(200).send("Logged out successfully");
  return;
});

app.get("/api/vacations", (req, res) => {
  const sql = "SELECT * FROM vacations";
  conn.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching vacations data:", err);
      res.status(500).json({ error: "Error fetching vacations data" });
    } else {
      res.status(200).json(results);
    }
  });
});

app.post("/api/toggleFavorite", withAuth, (req, res) => {
  const userEmail = req.email;
  const { vacationId } = req.body;
  const sql = `SELECT id FROM users WHERE email = ?`;
  conn.query(sql, [userEmail], (err, userResults) => {
    if (err) {
      console.error("Error fetching user ID:", err);
      res.status(500).json({ error: "Error fetching user ID" });
    } else if (userResults.length === 0) {
      res.status(400).json({ error: "User not found" });
    } else {
      const userId = userResults[0].id;
      const sql = `SELECT * FROM followers WHERE user_id = ? AND vacation_id = ?`;
      conn.query(sql, [userId, vacationId], (err, results) => {
        if (err) {
          console.error("Error checking favorite:", err);
          res.status(500).json({ error: "Error checking favorite" });
        } else {
          if (results.length === 0) {
            const sql = `INSERT INTO followers (user_id, vacation_id) VALUES (?, ?)`;
            conn.query(sql, [userId, vacationId], (err) => {
              if (err) {
                console.error("Error adding favorite:", err);
                res.status(500).json({ error: "Error adding favorite" });
              } else {
                res.status(200).send("Favorite added successfully");
              }
            });
          } else {
            const sql = `DELETE FROM followers WHERE user_id = ? AND vacation_id = ?`;
            conn.query(sql, [userId, vacationId], (err) => {
              if (err) {
                console.error("Error removing favorite:", err);
                res.status(500).json({ error: "Error removing favorite" });
              } else {
                res.status(200).send("Favorite removed successfully");
              }
            });
          }
        }
      });
    }
  });
});

app.get("/api/favoriteVacations", withAuth, (req, res) => {
  const userEmail = req.email;
  const sql = `
    SELECT vacation_id
    FROM followers
    WHERE user_id = (SELECT id FROM users WHERE email = ?)
  `;

  conn.query(sql, [userEmail], (err, results) => {
    if (err) {
      console.error("Error fetching favorite vacations:", err);
      res.status(500).json({ error: "Error fetching favorite vacations" });
      return;
    } else {
      const favoriteVacations = results.map((item) => item.vacation_id);
      res.status(200).json(favoriteVacations);
    }
  });
});

app.get("/api/vacationFollowersCount", (req, res) => {
  const sql = `
    SELECT vacation_id, COUNT(*) AS followers_count
    FROM followers
    GROUP BY vacation_id
  `;
  conn.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching vacation followers count:", err);
      res
        .status(500)
        .json({ error: "Error fetching vacation followers count" });
      return;
    } else {
      const followersCountData = results.reduce((acc, result) => {
        acc[result.vacation_id] = result.followers_count;
        return acc;
      }, {});
      res.status(200).json(followersCountData);
    }
  });
});

app.get("/api/followersCount", (req, res) => {
  const sql = `
    SELECT v.id, v.destination, COUNT(f.vacation_id) AS followers_count
    FROM vacations v
    LEFT JOIN followers f ON v.id = f.vacation_id
    GROUP BY v.id, v.destination
  `;
  conn.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching vacation followers count:", err);
      res
        .status(500)
        .json({ error: "Error fetching vacation followers count" });
      return;
    } else {
      console.log("Results:", results);
      res.status(200).json(results);
    }
  });
});

app.delete("/api/vacations/:id", withAuth, (req, res) => {
  const vacationId = req.params.id;
  const sql = "DELETE FROM vacations WHERE id = ?";
  conn.query(sql, [vacationId], (err) => {
    if (err) {
      console.error("Error deleting vacation:", err);
      res.status(500).json({ error: "Error deleting vacation" });
    } else {
      res.status(200).send("Vacation deleted successfully");
    }
  });
});

app.get("/api/vacations/:id", (req, res) => {
  const vacationId = req.params.id;
  const sql = "SELECT * FROM vacations WHERE id = ?";
  conn.query(sql, [vacationId], (err, results) => {
    if (err) {
      console.error("Error fetching vacation data:", err);
      res.status(500).json({ error: "Error fetching vacation data" });
    } else {
      if (results.length === 0) {
        res.status(404).json({ error: "Vacation not found" });
      } else {
        res.status(200).json(results[0]);
      }
    }
  });
});

app.put("/api/vacations/:id", (req, res) => {
  const vacationId = req.params.id;
  const updatedData = req.body;

  const sql = `
    UPDATE vacations
    SET destination = ?, description = ?, start_date = ?, end_date = ?, image_name = ?, price = ?
    WHERE id = ?
  `;

  const params = [
    updatedData.destination,
    updatedData.description,
    updatedData.start_date,
    updatedData.end_date,
    updatedData.image_name,
    updatedData.price,
    vacationId,
  ];

  conn.query(sql, params, (err) => {
    if (err) {
      console.error("Error updating vacation:", err);
      res.status(500).json({ error: "Error updating vacation" });
    } else {
      res.status(200).send("Vacation updated successfully");
    }
  });
});

app.listen(9090, () => {
  console.log("Listening to port 9090");
});
