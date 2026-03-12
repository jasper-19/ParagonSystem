import dotenv from "dotenv";

// Load environment variables before any other imports resolve their env values
dotenv.config();

import app from "./app";

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});