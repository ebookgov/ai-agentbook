"use client";

import { motion } from "framer-motion";
import { Bed, Bath, Move, MapPin, ArrowRight } from "lucide-react";
import Image from "next/image";
import { type Listing } from "@/lib/data";

interface ListingCardProps {
    listing: Listing;
    index: number;
}

export function ListingCard({ listing, index }: ListingCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: index * 0.2 }}
            className="group relative overflow-hidden rounded-lg bg-card text-card-foreground shadow-sm hover:shadow-xl transition-shadow duration-300 border border-border/50"
        >
            <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                    src={listing.image}
                    alt={listing.address}
                    width={800}
                    height={600}
                    className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4 text-white">
                    <p className="text-sm font-medium uppercase tracking-wider mb-1">
                        New Listing
                    </p>
                    <h3 className="text-2xl font-serif">{listing.price.toLocaleString("en-US", { style: "currency", currency: "USD" })}</h3>
                </div>
            </div>

            <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <div className="flex items-center text-muted-foreground mb-2">
                            <MapPin className="w-4 h-4 mr-1" />
                            <span className="text-sm">{listing.address}</span>
                        </div>
                        <p className="line-clamp-2 text-sm text-foreground/80">
                            {listing.description}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 py-4 border-t border-border/50">
                    <div className="flex flex-col items-center">
                        <Bed className="w-5 h-5 mb-1 text-secondary" />
                        <span className="text-sm font-medium">{listing.beds} Beds</span>
                    </div>
                    <div className="flex flex-col items-center border-l border-border/50">
                        <Bath className="w-5 h-5 mb-1 text-secondary" />
                        <span className="text-sm font-medium">{listing.baths} Baths</span>
                    </div>
                    <div className="flex flex-col items-center border-l border-border/50">
                        <Move className="w-5 h-5 mb-1 text-secondary" />
                        <span className="text-sm font-medium">{listing.sqft.toLocaleString()} Sqft</span>
                    </div>
                </div>

                <button className="w-full mt-4 bg-primary text-primary-foreground py-3 px-4 rounded-md flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors uppercase text-sm tracking-wide">
                    View Details
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </motion.div>
    );
}
