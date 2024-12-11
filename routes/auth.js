const router = require("express").Router();
const passport = require("passport");
require("../config/passport")(passport);
const registerValidation = require("../validation").registerValidation;
const loginValidation = require("../validation").loginValidation;
const editValidation = require("../validation").editValidation;
const User = require("../models").user;
const jwt = require("jsonwebtoken");
const multer = require("multer");

router.use((req, res, next) => {
  console.log("正在接受一個auth請求");
  next();
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "skillboost", // 你的專案資料夾名稱
    allowed_formats: ["jpg", "png", "webp", "jpeg"], // 允許的格式
    transformation: [{ width: 500, height: 500, crop: "limit" }], // 可選的圖片處理
  },
});

const upload = multer({ storage: storage });

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

    // 如果有新圖片上傳且存在舊的 Cloudinary 圖片
    if (req.file && currentUser.image) {
      try {
        // 從 URL 中獲取公開 ID
        const publicId = currentUser.image
          .split("/")
          .slice(-2)
          .join("/")
          .split(".")[0]; // 獲取不帶副檔名的公開 ID

        await cloudinary.uploader.destroy(publicId);
        console.log("舊圖片已從 Cloudinary 刪除");
      } catch (err) {
        console.error("刪除 Cloudinary 圖片時發生錯誤:", err);
      }
    }

    const imageUrl = req.file ? req.file.path : currentUser.image;
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
