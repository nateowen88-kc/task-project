import app from "../src/server/app.js";

const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
  console.log(`TimeSmith server listening on port ${port}`);
});
