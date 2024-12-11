const express = require("express");
const app = express();
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const authRoutes = require("./routes").auth;
const courseRoutes = require("./routes").course;
const orderRoutes = require("./routes").order;
const ecpay = require("./routes/index").ecpay;
const passport = require("passport");
require("./config/passport")(passport);
const cors = require("cors");

mongoose
  .connect(process.env.MONGODB_CONNECTION)
  .then(() => console.log("成功連線至mongoDB..."))
  .catch((e) => console.log(e));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use("/api/ecpay", ecpay);
app.use("/api/user", authRoutes);

app.use(
  "/api/course",
  passport.authenticate("jwt", { session: false }),
  courseRoutes
);

app.use(
  "/api/order",
  passport.authenticate("jwt", { session: false }),
  orderRoutes
);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`後端伺服器正在聆聽port ${port}...`);
});
