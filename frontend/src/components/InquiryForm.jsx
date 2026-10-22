import { useState } from "react";

import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

// Must match CLOSED_INQUIRY_RETENTION_DAYS in backend/src/models/Inquiry.js.
const CLOSED_INQUIRY_RETENTION_DAYS = 180;

const InquiryForm = ({ property, onSuccess }) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  // Honeypot: hidden from humans, so only bots fill it in.
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!phone.trim() && !email.trim()) {
      setError("יש למלא טלפון או אימייל כדי שנוכל לחזור אליך.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/api/properties/${property._id}/inquiries`, {
        name,
        phone,
        email,
        message,
        website,
      });
      setIsSent(true);
    } catch (err) {
      if (err.response?.status === 429) {
        setError("נשלחו יותר מדי פניות. נסה/י שוב מאוחר יותר.");
      } else {
        setError("שגיאה בשליחת הפנייה. בדוק/י את הפרטים ונסה/י שוב.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSent) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-base font-semibold">הפנייה נשלחה בהצלחה!</p>
        <p className="text-sm text-muted-foreground">
          ניצור איתך קשר בהקדם.
        </p>
        <Button size="lg" onClick={onSuccess}>
          סגירה
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="inquiry-name">שם (לא חובה)</Label>
        <Input
          id="inquiry-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          autoFocus
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="inquiry-phone">טלפון</Label>
          <Input
            id="inquiry-phone"
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="inquiry-email">אימייל</Label>
          <Input
            id="inquiry-email"
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        יש למלא לפחות טלפון או אימייל.
      </p>

      <div className="grid gap-2">
        <Label htmlFor="inquiry-message">הודעה</Label>
        <Textarea
          id="inquiry-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          rows={4}
          required
        />
      </div>

      <div className="absolute -left-[9999px] size-px overflow-hidden" aria-hidden="true">
        <label htmlFor="inquiry-website">Website</label>
        <input
          id="inquiry-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <p className="text-xs leading-relaxed text-muted-foreground">
        הפרטים שתמסור/י ישמשו רק כדי לחזור אליך בנוגע לנכס זה, ולא יועברו
        לצד שלישי. הפנייה תימחק אוטומטית {CLOSED_INQUIRY_RETENTION_DAYS} יום
        לאחר שהטיפול בה יסתיים.
      </p>

      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "שולח…" : "שליחת פנייה"}
      </Button>
    </form>
  );
};

export default InquiryForm;
