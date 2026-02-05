// src/components/NowCard.js
import React, { useEffect, useState } from "react";
import Card from "react-bootstrap/Card";
import Badge from "react-bootstrap/Badge";

export default function NowCard({ currentUser }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <Card className="mb-3">
      <Card.Body className="d-flex justify-content-between align-items-center">
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>
            {now.toLocaleString(undefined, {
              hour: "numeric",
              minute: "2-digit"
            })}
          </div>
                    <div className="text-muted" style={{ fontSize: 12 }}>
            {now.toLocaleString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric"
            })}<br/>
            <b>Welcome back, {currentUser ? currentUser.first_name : "…"}!</b>
          </div>
        
        </div>
      </Card.Body>
    </Card>
  );
}
