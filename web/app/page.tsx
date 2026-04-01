"use client";

import { useEffect, useState } from "react";
import Link from 'next/link';

export default function Home() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:4000/api/v1/companies', {
      headers: {
        'x-tenant-id': 'tttttttt-0000-0000-0000-000000000001'
      }
    })
      .then(res => res.json())
      .then(data => {
        setCompanies(data.data || []);
        setLoading(false);
      })
      .catch(e => {
        console.error("Failed to fetch companies:", e);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full bg-white shadow-xl rounded-2xl p-10 mt-10 text-center ring-1 ring-gray-100">
        <div className="flex justify-center mb-6">
          <div className="bg-finance-50 text-finance-900 p-4 rounded-full font-bold text-4xl shadow-sm border border-finance-500/20">
            FPE
          </div>
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
          Financial Performance Engine
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          Phase 1 Planning Spine MVP & Dashboard Interface (Tier 1). Ready for scenario analysis.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          <Link href="/dashboard" className="p-6 block bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 shadow-sm transition hover:shadow-md cursor-pointer">
            <h3 className="text-indigo-900 font-bold mb-2 flex items-center gap-2">
              <span className="bg-white p-1 rounded-md shadow-sm">📊</span> Executive Cockpit
            </h3>
            <p className="text-indigo-700/80 text-sm">
              View global planning overview, P&L snap, and scenario performance.
            </p>
          </Link>
          <div className="p-6 bg-gradient-to-br from-finance-50 to-emerald-50 rounded-xl border border-finance-100 shadow-sm transition hover:shadow-md cursor-pointer">
            <h3 className="text-finance-900 font-bold mb-2 flex items-center gap-2">
              <span className="bg-white p-1 rounded-md shadow-sm">🏢</span> Tenant Connectivity
            </h3>
            <p className="text-finance-700/80 text-sm mb-3">
              Testing API linkage with Phase 1 data requirements:
            </p>
            {loading ? (
              <div className="animate-pulse bg-white/50 h-8 rounded-md w-1/2"></div>
            ) : (
              <div className="bg-white px-3 py-2 rounded-lg text-sm text-gray-700 font-mono border border-emerald-100">
                Data State: {companies.length > 0 ? "LIVE" : "EMPTY"}
                <br/>
                Records: {companies.length} rows loaded.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
