import { useState } from "react";

import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const AddAdminForm = ({ onSuccess }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await api.post("/api/auth/register", { name, email, password });
      onSuccess?.();
    } catch (err) {
      setError(
        err.response?.data?.message || "שגיאה בהוספת מנהל. נסה/י שוב.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="add-admin-name">שם</Label>
        <Input
          id="add-admin-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="add-admin-email">אימייל</Label>
        <Input
          id="add-admin-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="add-admin-password">סיסמה</Label>
        <Input
          id="add-admin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" size="lg" className="mt-2" disabled={isSubmitting}>
        {isSubmitting ? "מוסיף…" : "הוספת מנהל"}
      </Button>
    </form>
  );
};

export default AddAdminForm;
