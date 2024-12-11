const express = require("express");
const router = express.Router();
const ecpay_payment = require("ecpay_aio_nodejs");
const clientApiUrl = `https://skill-boost-web.netlify.app/CurrentUserCourse`;
require("dotenv").config();

const { MERCHANTID, HASHKEY, HASHIV, HOST } = process.env;

const options = {
  OperationMode: "Test",
  MercProfile: {
    MerchantID: MERCHANTID,
    HashKey: HASHKEY,
    HashIV: HASHIV,
  },
  IgnorePayment: [],
  IsProjectContractor: false,
};

// 產生簡單的購買表單
router.get("/payment", (req, res) => {
  const { amount, items } = req.query;

  const MerchantTradeDate = new Date().toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const TradeNo = "test" + new Date().getTime();

  const base_param = {
    MerchantTradeNo: TradeNo,
    MerchantTradeDate: MerchantTradeDate,
    TotalAmount: amount || "100",
    TradeDesc: "課程購買",
    ItemName: items || "測試商品", // 使用傳入的商品名稱
    ReturnURL: `${HOST}/api/ecpay/return`,
    ClientBackURL: `${HOST}/api/ecpay/clientReturn`,
  };

  const create = new ecpay_payment(options);
  const html = create.payment_client.aio_check_out_all(base_param);

  res.send(html);
});

// 綠界付款完成後，會向這個 URL 發送 POST 請求
router.post("/return", (req, res) => {
  console.log("付款結果：", req.body);
  res.send("1|OK");
});

// 付款完成後，使用者會被導向這個頁面
router.get("/clientReturn", (req, res) => {
  res.redirect(clientApiUrl);
});

module.exports = router;
