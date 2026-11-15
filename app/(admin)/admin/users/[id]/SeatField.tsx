"use client";

import { useState } from "react";

// A disabled input is left out of the form data, so "Unlimited" sends only `unlimited_seats`.
export function SeatField({ seatCount, unlimited }: { seatCount: number | null; unlimited: boolean }) {
  const [isUnlimited, setUnlimited] = useState(unlimited);
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">Seat count</label>
      <input
        name="seat_count"
        type="number"
        min={1}
        defaultValue={seatCount ?? ""}
        placeholder={isUnlimited ? "unlimited" : "—"}
        disabled={isUnlimited}
        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm text-white disabled:opacity-50"
      />
      <div className="flex items-center gap-2 mt-1">
        <input
          type="checkbox"
          name="unlimited_seats"
          id="unlimited_seats"
          value="true"
          checked={isUnlimited}
          onChange={(e) => setUnlimited(e.target.checked)}
          className="accent-green-400"
        />
        <label htmlFor="unlimited_seats" className="text-xs text-gray-400 select-none">
          Unlimited seats
        </label>
      </div>
    </div>
  );
}
