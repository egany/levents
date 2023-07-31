// require("dotenv").config({ path: "./.env.test" });
// const shopify = require("../lib/shopify");

// const { TEST_DATA_EMAIL, TEST_DATA_PHONE } = process.env;
// const _data = {
//   email: TEST_DATA_EMAIL,
//   phone: TEST_DATA_PHONE,
//   odooCustomerId: 422,
// };

// jest.useRealTimers();

// describe("Test the Shopify API", () => {
//   let shopifyCustomer;

//   test("Read one customer not exist", async () => {
//     const resutl = await shopify.readOneCustomer({
//       query: {
//         email: _data.email,
//       },
//     });
//     expect(resutl.data).toBeNull();
//     expect(resutl.errors).toHaveLength(0);
//   });

//   test("Create one customer", async () => {
//     const resutl = await shopify.createOneCustomer({
//       email: _data.email,
//       phone: _data.phone,
//       metafields: [
//         {
//           key: "odooCustomerId",
//           namespace: "levents",
//           type: "number_integer",
//           value: _data.odooCustomerId.toString(),
//         },
//       ],
//     });
//     expect(resutl.data).not.toBeNull();
//     expect(resutl.errors).toHaveLength(0);
//     shopifyCustomer = resutl.data;
//   });

//   test("Delete one customer", async () => {
//     const resutl = await shopify.deleteOneCustomer({
//       id: shopifyCustomer.id,
//     });
//     expect(resutl.data).not.toBeNull();
//     expect(resutl.data.id).toEqual(shopifyCustomer.id);
//     expect(resutl.errors).toHaveLength(0);
//     shopifyCustomer = resutl.data;
//   });
// });
