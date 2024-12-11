const router = require("express").Router();
const passport = require("passport");
require("../config/passport")(passport);
const registerValidation = require("../validation").registerValidation;
const loginValidation = require("../validation").loginValidation;
const editValidation = require("../validation").editValidation;
const User = require("../models").user;
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

router.use((req, res, next) => {
  console.log("正在接受一個auth請求");
  next();
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

router.post("/register", async (req, res) => {
  let { error } = registerValidation(req.body);
  if (error) {
    return res.status(400).send(error.details[0].message);
  }

  const checkEmailExist = await User.findOne({ email: req.body.email }).exec();
  if (checkEmailExist) return res.status(400).send("此Email已經被註冊過了...");

  let { username, password, email, role } = req.body;
  let newUser = new User({ username, password, email, role });
  try {
    let saveUser = await newUser.save();
    return res.send({
      msg: "註冊成功!",
      saveUser,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).send("無法儲存使用者...");
  }
});

router.post("/login", async (req, res) => {
  let { error } = loginValidation(req.body);
  if (error) {
    return res.status(400).send(error.details[0].message);
  }

  const foundUser = await User.findOne({ email: req.body.email }).exec();
  if (!foundUser)
    return res.status(401).send("無法找到使用者 請確認信箱是否正確...");

  foundUser.comparePassword(req.body.password, (err, isMatch) => {
    if (err) return res.status(500).send(err);
    if (isMatch) {
      const tokenObject = { _id: foundUser._id, email: foundUser.email };
      const token = jwt.sign(tokenObject, process.env.PASSPORT_SECRET);
      return res.send({
        msg: "登入成功!",
        token: "JWT " + token,
        foundUser,
      });
    } else {
      return res.status(401).send("密碼錯誤...");
    }
  });
});

router.put(
  "/editProfile",
  passport.authenticate("jwt", { session: false }),
  upload.single("image"),
  async (req, res) => {
    let { error } = editValidation(req.body);
    if (error) {
      return res.status(400).send(error.details[0].message);
    }

    const { username, description } = req.body;
    const currentUser = await User.findById(req.user._id);

    if (
      req.file &&
      currentUser.image &&
      currentUser.image.startsWith("/uploads/")
    ) {
      const oldImagePath = path.join(__dirname, "..", currentUser.image);
      if (fs.existsSync(oldImagePath)) {
        try {
          fs.unlinkSync(oldImagePath); // 刪除舊圖片
          console.log("舊圖片已刪除:", oldImagePath);
        } catch (err) {
          console.log("無法刪除舊圖片:", err);
        }
      }
    }

    const imageUrl = req.file
      ? `/uploads/${req.file.filename}`
      : currentUser.image;
    try {
      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { username, description, image: imageUrl },
        {
          new: true,
        }
      );
      const { password, ...userWithoutPassword } = updatedUser.toObject();
      res.send({
        msg: "個人資訊更新成功!",
        userWithoutPassword,
      });
    } catch (e) {
      console.log(e);
      return res.status(500).send("無法更新個人資訊...");
    }
  }
);

module.exports = router;
