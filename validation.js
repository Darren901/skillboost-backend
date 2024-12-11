const Joi = require("joi");

const registerValidation = (data) => {
  const schema = Joi.object({
    username: Joi.string().min(3).max(20).required(),
    email: Joi.string().min(6).max(50).required().email(),
    password: Joi.string().min(6).max(255).required(),
    role: Joi.string().required().valid("student", "instructor"),
  });

  return schema.validate(data);
};

const editValidation = (data) => {
  const schema = Joi.object({
    username: Joi.string().min(3).max(20),
    email: Joi.string().min(6).max(50).email(),
    password: Joi.string().min(6).max(255),
    role: Joi.string().valid("student", "instructor"),
    image: Joi.string().uri().optional(),
    description: Joi.string().max(50).optional(),
  });

  return schema.validate(data);
};

const loginValidation = (data) => {
  const schema = Joi.object({
    email: Joi.string().min(6).max(50).required().email(),
    password: Joi.string().min(6).max(255).required(),
  });

  return schema.validate(data);
};

const courseValidation = (data) => {
  const schema = Joi.object({
    title: Joi.string().min(6).max(20).required(),
    description: Joi.string().min(6).max(30).required(),
    price: Joi.number().min(10).max(99999).required(),
    content: Joi.string().min(6).required(),
    videoUrl: Joi.string().required(),
  });

  return schema.validate(data);
};

module.exports.registerValidation = registerValidation;
module.exports.loginValidation = loginValidation;
module.exports.courseValidation = courseValidation;
module.exports.editValidation = editValidation;
