const router = require("express").Router();
const courseValidation = require("../validation").courseValidation;
const Course = require("../models").course;
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

router.use((req, res, next) => {
  console.log("courseRoute正在接收一個request...");
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

// find all course
router.get("/", async (req, res) => {
  try {
    let courseFound = await Course.find({})
      .populate("instructor", ["username", "email"])
      .populate("comments.userId", ["username", "image"])
      .exec();
    return res.send(courseFound);
  } catch (e) {
    return res.status(500).send(e);
  }
});

// instructor id find course
router.get("/instructor/:_instructor_id", async (req, res) => {
  let { _instructor_id } = req.params;
  try {
    let coursesFound = await Course.find({ instructor: _instructor_id })
      .populate("instructor", ["username", "email"])
      .populate("comments.userId", ["username", "image"])
      .exec();

    if (coursesFound.length === 0) {
      return res.status(404).send("未找到該講師的任何課程。");
    }

    return res.send(coursesFound);
  } catch (error) {
    console.error(error);
    return res.status(500).send("查詢課程時出現錯誤，請稍後再試。");
  }
});

// use student id find enroll course
router.get("/student/:_student_id", async (req, res) => {
  const { _student_id } = req.params;

  try {
    const coursesFound = await Course.find({ students: _student_id })
      .populate("instructor", ["username", "email"])
      .populate("comments.userId", ["username", "image"])
      .exec();

    if (coursesFound.length === 0) {
      return res.status(404).send("該學生尚未註冊任何課程。");
    }

    return res.send(coursesFound);
  } catch (error) {
    console.error(error);
    return res.status(500).send("查詢課程時出現錯誤，請稍後再試。");
  }
});

// use nameLike found course
router.get("/findByName/:name", async (req, res) => {
  let { name } = req.params;
  try {
    let foundCourses = await Course.find({
      title: { $regex: name, $options: "i" },
    })
      .populate("instructor", ["email", "username"])
      .exec();

    if (foundCourses.length === 0) {
      return res.status(404).send("未找到任何符合條件的課程。");
    }

    return res.send(foundCourses);
  } catch (e) {
    return res.status(500).send(e);
  }
});

// get top5 courses
router.get("/top5", async (req, res) => {
  try {
    let top5Course = await Course.find({})
      .populate("instructor", ["username", "email"])
      .exec();

    top5Course = top5Course
      .map((course) => {
        return {
          ...course.toObject(),
          averageRating: course.averageRating || 0,
          ratings: course.ratings || [],
          studentCount: course.students.length,
        };
      })
      .sort((a, b) => b.studentCount - a.studentCount)
      .slice(0, 5);

    return res.send(top5Course);
  } catch (e) {
    console.error("Top5 courses error:", e);
    return res.status(500).send({ message: "Error occurred", error: e });
  }
});

// 獲取某個課程的留言
router.get("/messages/:_id", async (req, res) => {
  let { _id } = req.params;
  try {
    let foundMessage = await Course.findById({ _id }, { comments: 1 }).exec();
    if (!foundMessage) return res.status(404).send("找不到課程");
    res.status(200).send(foundMessage);
  } catch (e) {
    return res.status(500).send(e);
  }
});

// use course id find course
router.get("/:_id", async (req, res) => {
  let { _id } = req.params;
  try {
    let foundCourse = await Course.findById({ _id })
      .populate("instructor", ["email", "username"])
      .populate("comments.userId", ["username", "image"])
      .exec();

    if (!foundCourse) {
      return res.status(404).send("未找到指定的課程。");
    }
    return res.send(foundCourse);
  } catch (e) {
    return res.status(500).send(e);
  }
});

// add new course
router.post("/", upload.single("image"), async (req, res) => {
  let { error } = courseValidation(req.body);
  if (error) {
    return res.status(400).send(error.details[0].message);
  }

  if (req.user.isStudent()) {
    return res
      .status(400)
      .send("只有講師才能發布新課程。若你已經是講師，請透過講師帳號登入。");
  }

  let { title, description, price, content, videoUrl } = req.body;
  const imageUrl = req.file ? req.file.path : null;
  try {
    let newCourse = new Course({
      title,
      description,
      price,
      instructor: req.user._id,
      image: imageUrl,
      content,
      videoUrl,
    });
    let saveCourse = await newCourse.save();
    return res.send({
      message: "新課程已經保存",
      saveCourse,
    });
  } catch (e) {
    return res.status(500).send("無法創建課程...");
  }
});

// let student use course id enroll course
router.post("/enroll/:_id", async (req, res) => {
  let { _id } = req.params;
  try {
    let courseFound = await Course.findOne({ _id }).exec();
    if (!courseFound) {
      return res.status(404).send("找不到課程。");
    }
    if (courseFound.students.includes(req.user._id)) {
      return res.status(400).send("你已經購買過這個課程。");
    }
    courseFound.students.push(req.user._id);
    await courseFound.save();
    return res.send("購買成功!");
  } catch (e) {
    return res.status(400).send("註冊失敗...");
  }
});

// update course
router.patch("/:_id", upload.single("image"), async (req, res) => {
  let { error } = courseValidation(req.body);
  if (error) {
    return res.status(400).send(error.details[0].message);
  }

  let { _id } = req.params;
  try {
    let foundCourse = await Course.findOne({ _id }).exec();
    if (!foundCourse) {
      return res.status(404).send("找不到該課程。無法更新課程內容");
    }

    if (foundCourse.instructor.equals(req.user._id)) {
      let { title, description, price, content, videoUrl } = req.body;

      // 如果有新圖片上傳且存在舊的 Cloudinary 圖片
      if (req.file && foundCourse.image) {
        try {
          // 從 URL 中獲取公開 ID
          const publicId = foundCourse.image
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

      const imageUrl = req.file ? req.file.path : foundCourse.image;

      let updateCourse = await Course.findOneAndUpdate(
        { _id },
        {
          title,
          description,
          price,
          instructor: req.user._id,
          image: imageUrl,
          content,
          videoUrl,
        },
        {
          new: true,
          runValidators: true,
        }
      );
      return res.send({
        message: "課程更新成功",
        updateCourse,
      });
    } else {
      return res.status(403).send("只有此課程的講師才能編輯課程");
    }
  } catch (e) {
    console.error("更新課程時發生錯誤:", e);
    return res.status(500).send("伺服器錯誤，請稍後再試");
  }
});

// 使用者評分
router.put("/:_id/rating", async (req, res) => {
  let userId = req.user._id;
  const { rating } = req.body;
  let { _id } = req.params;

  if (rating < 1 || rating > 5) {
    res.status(400).send("評分必須在一到五之間...");
  }

  try {
    let foundCourse = await Course.findById({ _id }).exec();
    if (!foundCourse) return res.status(404).send("找不到課程..");

    const existRating = foundCourse.ratings.find(
      (r) => r.userId.toString() == userId.toString()
    );

    if (existRating) {
      existRating.rating = rating;
    } else {
      foundCourse.ratings.push({ userId, rating });
    }

    const totalRatings = foundCourse.ratings.length;
    const sumOfRatings = foundCourse.ratings.reduce(
      (sum, r) => sum + r.rating,
      0
    );
    foundCourse.averageRating = (sumOfRatings / totalRatings).toFixed(1);

    await foundCourse.save();

    return res.status(200).send({
      msg: "評分成功",
      foundCourse,
    });
  } catch (e) {
    return res.status(500).send(e);
  }
});

// 新增留言
router.put("/messages/:_id", async (req, res) => {
  try {
    const { commentText } = req.body;
    const { _id } = req.params;
    const userId = req.user._id;

    let course = await Course.findById(_id);
    if (!course) {
      return res.status(404).json({ message: "課程不存在" });
    }

    course.comments.push({
      userId,
      commentText,
    });

    await course.save();

    course = await Course.findById(_id)
      .populate("instructor", ["username", "email"])
      .populate("comments.userId", ["username", "image"])
      .exec();

    res.status(200).json(course);
  } catch (error) {
    res.status(500).json({ message: "新增留言失敗", error: error.message });
  }
});

// delete course
router.delete("/:_id", async (req, res) => {
  let { _id } = req.params;
  try {
    let foundCourse = await Course.findOne({ _id }).exec();
    if (!foundCourse) {
      return res
        .status(404)
        .send("找不到該課程或者此內容已被刪除。無法刪除課程內容");
    }

    if (foundCourse.instructor.equals(req.user._id)) {
      await Course.deleteOne({ _id }).exec();
      return res.send("課程已被刪除");
    } else {
      return res.status(403).send("只有此課程的講師才能刪除課程");
    }
  } catch (e) {
    return res.status(500).send(e);
  }
});

// 刪除留言
router.delete("/messages/:course_id/:message_id", async (req, res) => {
  let { course_id, message_id } = req.params;

  try {
    let foundCourse = await Course.findById(course_id).exec();
    if (!foundCourse) return res.status(404).send("找不到課程");

    const messageExists = foundCourse.comments.some(
      (comment) => comment._id.toString() === message_id
    );
    if (!messageExists) return res.status(404).send("找不到留言");

    foundCourse.comments = foundCourse.comments.filter(
      (comment) => comment._id.toString() !== message_id
    );

    await foundCourse.save();
    return res.status(200).send(foundCourse);
  } catch (e) {
    return res.status(500).send(e);
  }
});

module.exports = router;
