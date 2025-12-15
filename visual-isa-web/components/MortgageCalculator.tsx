"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export function MortgageCalculator() {
    const [price, setPrice] = useState(2500000);
    const [downPayment, setDownPayment] = useState(20);
    const [rate, setRate] = useState(6.5);
    const [term, setTerm] = useState(30);

    const calculateMonthlyPayment = () => {
        const principal = price * (1 - downPayment / 100);
        const monthlyRate = rate / 100 / 12;
        const numberOfPayments = term * 12;

        const monthlyPayment =
            (principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
            (Math.pow(1 + monthlyRate, numberOfPayments) - 1);

        return monthlyPayment.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-card text-card-foreground p-8 rounded-xl border border-border shadow-lg"
        >
            <div className="mb-6">
                <h3 className="text-2xl font-serif text-primary mb-2">Mortgage Calculator</h3>
                <p className="text-muted-foreground text-sm">Estimate your monthly payments</p>
            </div>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium mb-2">Home Price: ${price.toLocaleString()}</label>
                    <input
                        type="range"
                        min="500000"
                        max="10000000"
                        step="50000"
                        value={price}
                        onChange={(e) => setPrice(Number(e.target.value))}
                        className="w-full accent-secondary h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">Down Payment: {downPayment}%</label>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={downPayment}
                        onChange={(e) => setDownPayment(Number(e.target.value))}
                        className="w-full accent-secondary h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Interest Rate (%)</label>
                        <input
                            type="number"
                            value={rate}
                            onChange={(e) => setRate(Number(e.target.value))}
                            className="w-full p-2 bg-background border border-border rounded-md text-sm focus:ring-2 focus:ring-secondary focus:border-transparent outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Term (Years)</label>
                        <select
                            value={term}
                            onChange={(e) => setTerm(Number(e.target.value))}
                            className="w-full p-2 bg-background border border-border rounded-md text-sm focus:ring-2 focus:ring-secondary focus:border-transparent outline-none"
                        >
                            <option value="15">15 Years</option>
                            <option value="30">30 Years</option>
                        </select>
                    </div>
                </div>

                <div className="mt-8 p-4 bg-muted/50 rounded-lg flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Est. Monthly Payment</span>
                    <span className="text-xl font-bold text-primary flex items-center">
                        {calculateMonthlyPayment()}
                        <span className="text-xs font-normal text-muted-foreground ml-1">/mo</span>
                    </span>
                </div>
            </div>
        </motion.div>
    );
}
