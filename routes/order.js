const router = require("express").Router();
const Order = require("../models").order;
const Course = require("../models").course;

router.use((req, res, next) => {
  console.log("orderRoute正在接收一個request...");
  next();
});

// 查詢購物車內容
router.get("/cart", async (req, res) => {
  try {
    const userId = req.user._id;
    const cart = await Order.findOne({ userId, status: "cart" })
      .populate({
        path: "courses.courseId",
        select: [
          "title",
          "price",
          "image",
          "averageRating",
          "ratings",
          "instructor",
        ],
        populate: {
          path: "instructor",
          select: "username",
        },
      })
      .exec();

    if (!cart) return res.status(404).send("購物車為空");

    return res.status(200).send(cart);
  } catch (e) {
    return res.status(500).send(e);
  }
});

// 查詢歷史訂單
router.get("/orders", async (req, res) => {
  try {
    const userId = req.user._id;
    const orders = await Order.find({ userId, status: "order" })
      .populate({
        path: "courses.courseId",
        select: [
          "title",
          "price",
          "image",
          "averageRating",
          "ratings",
          "instructor",
        ],
        populate: {
          path: "instructor",
          select: "username",
        },
      })
      .exec();

    if (orders.length === 0) return res.status(404).send("沒有訂單紀錄");

    return res.status(200).send(orders);
  } catch (e) {
    return res.status(500).send(e);
  }
});

// 查詢單筆訂單
router.get("/:_id", async (req, res) => {
  let { _id } = req.params;
  try {
    let foundOrder = await Order.findById({ _id })
      .populate({
        path: "courses.courseId",
        select: [
          "title",
          "price",
          "image",
          "averageRating",
          "ratings",
          "instructor",
        ],
        populate: {
          path: "instructor",
          select: "username",
        },
      })
      .exec();
    if (!foundOrder) {
      return res.status(404).send("查無此訂單");
    }
    return res.send(foundOrder);
  } catch (e) {
    return res.status(500).send(e);
  }
});

const calculateTotalPrice = (courses) => {
  return courses.reduce((total, course) => total + course.price, 0);
};

// 新增課程至購物車
router.post("/add-to-cart", async (req, res) => {
  try {
    const userId = req.user._id;
    const { courseId } = req.body;

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).send("課程未找到");

    let order = await Order.findOne({ userId, status: "cart" });

    if (!order) {
      order = new Order({
        userId: userId,
        courses: [{ courseId, title: course.title, price: course.price }],
        status: "cart",
        createdAt: new Date(),
        totalPrice: course.price,
      });
    } else {
      const isCourseInCart = order.courses.some(
        (c) => c.courseId.toString() === courseId
      );
      if (isCourseInCart) {
        return res.status(400).send("該課程已在購物車中");
      }
      order.courses.push({
        courseId,
        title: course.title,
        price: course.price,
      });
      order.totalPrice = calculateTotalPrice(order.courses);
    }

    await order.save();
    return res.status(200).send(order);
  } catch (e) {
    return res.status(500).send(e);
  }
});

// 刪除訂單詳細
router.delete("/cart/:courseId", async (req, res) => {
  const userId = req.user._id;
  const { courseId } = req.params;

  try {
    const order = await Order.findOne({ userId, status: "cart" });

    if (!order) return res.status(404).send("購物車為空");

    order.courses = order.courses.filter((course) => {
      return course.courseId.toString() !== courseId.toString();
    });
    order.totalPrice = calculateTotalPrice(order.courses);

    await order.save();
    return res.status(200).send(order);
  } catch (e) {
    return res.status(500).send(e);
  }
});

// 將使用者的購物車訂單狀態更新為已下單
router.put("/:_id", async (req, res) => {
  let { _id } = req.params;
  let userId = req.user._id;

  try {
    let order = await Order.findOne({ _id, userId, status: "cart" });
    if (!order) {
      return res.status(404).send("查無此訂單或訂單不屬於該用戶");
    }

    if (order.courses.length === 0) {
      return res.status(400).send("無法下單：購物車為空");
    }

    order.status = "order";
    let updatedOrder = await order.save();

    return res.send(updatedOrder);
  } catch (e) {
    return res.status(500).send(e);
  }
});

// 刪除訂單
router.delete("/:_id", async (req, res) => {
  let { _id } = req.params;
  try {
    let deletedOrder = await Order.findByIdAndDelete(_id);
    if (!deletedOrder) {
      return res.status(404).send("查無此訂單，無法刪除");
    }
    return res.status(200).send("訂單已刪除...");
  } catch (e) {
    return res.status(500).send(e);
  }
});

module.exports = router;
