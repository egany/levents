const express = require("express");
const router = express.Router();
const axios = require("axios").default;
const {
  createProxyMiddleware,
  fixRequestBody,
} = require("http-proxy-middleware");

const PER_PAGE = 50;

router.get("/api/v1/reviews/orders", async (req, res, next) => {
  /**@type {string} */
  let product_ids = req.query.product_ids || "";
  product_ids = product_ids.trim();

  if (!product_ids || product_ids === "") {
    return res.status(400).json({ messsage: "Missing product_ids" });
  }

  let shopifyProductIds = product_ids
    .split(",")
    .filter((id) => id && id.trim() !== "")
    .map((id) => id.trim());

  if (shopifyProductIds.length === 0) {
    return res.status(400).json({ messsage: "product_ids empty" });
  }

  let shop_domain = req.query.shop_domain;
  shop_domain = shop_domain.trim();

  if (!shop_domain || shop_domain === "") {
    return res.status(400).json({ messsage: "Missing shop_domain" });
  }

  let email = req.query.email || "";
  email = email.trim();

  if (!email || email === "") {
    return res.status(400).json({ messsage: "Missing email" });
  }

  let reviewer;

  try {
    const { data } = await axios({
      method: "GET",
      url: `${process.appSettings.judgeMeUrl}/api/v1/reviewers/-1?shop_domain=${shop_domain}&api_token=${process.appSettings.judgeMePrivateToken}&email=${email}`,
      headers: {
        "Content-Type": "application/json",
      },
    });

    reviewer = data?.reviewer;

    if (!reviewer) {
      return res.status(404).json({ message: "Not foud reviewer" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Read reviewer by email error" });
  }

  let productExternalIds = [];

  for (const spID of shopifyProductIds) {
    try {
      const { data } = await axios({
        method: "GET",
        url: `${process.appSettings.judgeMeUrl}/api/v1/products/-1?shop_domain=${shop_domain}&api_token=${process.appSettings.judgeMePrivateToken}&external_id=${spID}`,
        headers: {
          "Content-Type": "application/json",
        },
      });
      const extID = data?.product?.id;

      if (extID) {
        productExternalIds.push(extID);
      } else {
        console.error({ message: "external undefined" });
        return res
          .status(500)
          .json({ message: `Read product(internal) ${spID} error` });
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: `Read product ${spID} error` });
    }
  }

  let reviews = [];

  for (const extID of productExternalIds) {
    const allReviewsOfOnProduct = await readAllReviewsOfOneProduct(
      reviewer,
      extID,
      shop_domain,
      req,
      res
    );

    if (!allReviewsOfOnProduct) {
      return;
    } else {
      reviews = [...reviews, ...allReviewsOfOnProduct];
    }
  }

  return res.json(reviews);
});

router.post(
  "/api/v1/reviews",
  createProxyMiddleware({
    target: process.appSettings.judgeMeUrl,
    changeOrigin: true,
    pathRewrite: function (path, req) {
      return path.replace("/judge-me", "");
    },
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.appSettings.judgeMePrivateToken}`,
    },
    secure: false,
    onProxyReq: fixRequestBody,
  })
);

router.get(
  "/api/v1/reviews",
  async (req, res, next) => {
    const external_id = req.query.product_id;
    const shop_domain = req.query.shop_domain;
    let productId;

    try {
      const { data } = await axios({
        method: "GET",
        url: `${process.appSettings.judgeMeUrl}/api/v1/products/-1?shop_domain=${shop_domain}&api_token=${process.appSettings.judgeMePrivateToken}&external_id=${external_id}`,
        headers: {
          "Content-Type": "application/json",
        },
      });
      productId = data.product.id;
    } catch (error) {
      return next(error);
    }

    let count = 0;

    try {
      const { data } = await axios({
        method: "GET",
        url: `${process.appSettings.judgeMeUrl}/api/v1/reviews/count?shop_domain=${shop_domain}&api_token=${process.appSettings.judgeMePrivateToken}&product_id=${productId}`,
        headers: {
          "Content-Type": "application/json",
        },
      });

      count = data?.count;
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: `Count reviews of one product(internal) ${productId} error`,
      });
    }

    let reviews = [];

    if (count === 0) {
      return res.json({
        current_page: 1,
        per_page: 9999,
        reviews,
      });
    }

    const totalPages = calculateTotalPages(count, PER_PAGE);

    for (let page = 1; page <= totalPages; page++) {
      try {
        const { data } = await axios({
          method: "GET",
          url: `${process.appSettings.judgeMeUrl}/api/v1/reviews?shop_domain=${shop_domain}&api_token=${process.appSettings.judgeMePrivateToken}&product_id=${productId}&per_page=${PER_PAGE}&page=${page}`,
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (Array.isArray(data?.reviews) && data.reviews.length > 0) {
          for (const rv1 of data?.reviews) {
            if (
              rv1.hidden === false &&
              rv1.published === true &&
              parseBody(rv1.body) &&
              !reviews.find(
                (rv2) => parseBody(rv2.body) && compareRatedId(rv1, rv2)
              )
            ) {
              reviews.push(rv1);
            }
          }
        }
      } catch (error) {
        console.error(error);
        return res.status(500).json({
          message: `Read reviews of one product(internal) ${productId} at page ${page} error`,
        });
      }
    }

    return res.json({
      current_page: 1,
      per_page: 9999,
      reviews,
    });
  }

  // createProxyMiddleware({
  //   target: process.appSettings.judgeMeUrl,
  //   changeOrigin: true,
  //   pathRewrite: function (path, req) {
  //     let newPath = path.replace("/judge-me", "");
  //     newPath = updateQueryStringParameter(
  //       newPath,
  //       "api_token",
  //       process.appSettings.judgeMePrivateToken
  //     );
  //     newPath = updateQueryStringParameter(
  //       newPath,
  //       "product_id",
  //       req.query.product_id
  //     );
  //     return newPath;
  //   },
  //   headers: {
  //     "Content-Type": "application/json",
  //   },
  //   secure: false,
  //   onProxyReq: fixRequestBody,
  // })
);

async function readAllReviewsOfOneProduct(
  reviewer,
  productId,
  shopDomain,
  req,
  res,
  next
) {
  let count = 0;

  try {
    const { data } = await axios({
      method: "GET",
      url: `${process.appSettings.judgeMeUrl}/api/v1/reviews/count?shop_domain=${shopDomain}&api_token=${process.appSettings.judgeMePrivateToken}&product_id=${productId}&reviewer_id=${reviewer.id}`,
      headers: {
        "Content-Type": "application/json",
      },
    });

    count = data?.count;
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: `Count reviews of one product(internal) ${productId} error`,
    });
    return null;
  }

  let reviews = [];

  if (count === 0) {
    return reviews;
  }

  const totalPages = calculateTotalPages(count, PER_PAGE);

  for (let page = 1; page <= totalPages; page++) {
    try {
      const { data } = await axios({
        method: "GET",
        url: `${process.appSettings.judgeMeUrl}/api/v1/reviews?shop_domain=${shopDomain}&api_token=${process.appSettings.judgeMePrivateToken}&product_id=${productId}&reviewer_id=${reviewer.id}&per_page=${PER_PAGE}&page=${page}`,
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (Array.isArray(data?.reviews) && data.reviews.length > 0) {
        for (const rv1 of data?.reviews) {
          if (
            rv1.hidden === false &&
            parseBody(rv1.body) &&
            !reviews.find(
              (rv2) => parseBody(rv2.body) && compareRatedId(rv1, rv2)
            )
          ) {
            reviews.push(rv1);
          }
        }
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: `Read reviews of one product(internal) ${productId} at page ${page} error`,
      });
      return null;
    }
  }

  return reviews;
}

function parseBody(body) {
  try {
    return JSON.parse(body);
  } catch (error) {
    return null;
  }
}

function compareRatedId(review1, review2) {
  const ratedID1 = JSON.parse(review1.body).ratedId;
  const ratedID2 = JSON.parse(review2.body).ratedId;
  const isTrue = ratedID1 === ratedID2;
  return isTrue;
}

function calculateTotalPages(totalItems, itemsPerPage) {
  return Math.ceil(totalItems / itemsPerPage);
}

function updateQueryStringParameter(path, key, value) {
  const re = new RegExp("([?&])" + key + "=.*?(&|$)", "i");
  const separator = path.indexOf("?") !== -1 ? "&" : "?";
  if (path.match(re)) {
    return path.replace(re, "$1" + key + "=" + value + "$2");
  } else {
    return path + separator + key + "=" + value;
  }
}

module.exports = router;

//https://devlevents.egany.com/judge-me/api/v1/reviews?shop_domain=levents-dev-01.myshopify.com&product_ids=8185934381353,8185934577961,8185934577961,8192000819497&email=dawnnguyen.vn@gmail.com
