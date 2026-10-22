// Goes after requireAuth on every route that writes data. The demo admin sees
// the whole admin UI, but nothing it does may change the database.
export const blockDemo = (req, res, next) => {
  if (req.user?.isDemo) {
    return res
      .status(403)
      .json({ code: "DEMO_READ_ONLY", message: "Demo mode is read-only." });
  }
  next();
};
