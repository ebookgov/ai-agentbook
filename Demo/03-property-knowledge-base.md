# Property Knowledge Base - Arizona Rural Listings

## Overview

This document contains all demo property listings for the EbookGov AI Booking Agent. These are fictional properties designed to demonstrate the agent's capabilities.

## JSON Format (For Vapi Knowledge Base Upload)

```json
{
  "properties": [
    {
      "id": "AZ-FLAG-001",
      "name": "Mountain View Ranch - Flagstaff",
      "price": 425000,
      "priceFormatted": "$425,000",
      "acreage": 35,
      "location": {
        "city": "Flagstaff",
        "county": "Coconino",
        "state": "AZ",
        "distance": "15 miles east of Flagstaff"
      },
      "features": {
        "structure": "Log cabin",
        "bedrooms": 2,
        "bathrooms": 2,
        "water": "Well water",
        "power": "Solar panels + grid",
        "access": "Year-round paved road"
      },
      "zoning": "Agricultural/Residential",
      "highlights": [
        "Stunning San Francisco Peaks views",
        "Elk and deer habitat",
        "Bordered by Coconino National Forest",
        "Dark sky location"
      ],
      "keywords": ["flagstaff", "mountain", "ranch", "cabin", "forest", "views"]
    },
    {
      "id": "AZ-FLAG-002",
      "name": "Ponderosa Homestead",
      "price": 289000,
      "priceFormatted": "$289,000",
      "acreage": 20,
      "location": {
        "city": "Williams",
        "county": "Coconino",
        "state": "AZ",
        "distance": "25 minutes from Flagstaff"
      },
      "features": {
        "structure": "Single family home",
        "sqft": 1800,
        "bedrooms": 3,
        "bathrooms": 2,
        "water": "Well",
        "power": "Grid electric",
        "extras": ["Detached workshop", "Fenced pasture"]
      },
      "zoning": "Rural Residential",
      "highlights": [
        "Ponderosa pine forest setting",
        "Quiet county road",
        "30 minutes to Grand Canyon",
        "Workshop for hobbies/business"
      ],
      "keywords": ["williams", "homestead", "ponderosa", "workshop", "grand canyon"]
    },
    {
      "id": "AZ-COC-001",
      "name": "High Desert Retreat",
      "price": 175000,
      "priceFormatted": "$175,000",
      "acreage": 40,
      "location": {
        "city": "Parks",
        "county": "Coconino",
        "state": "AZ",
        "distance": "20 miles west of Flagstaff"
      },
      "features": {
        "structure": "Raw land",
        "buildingSite": "Cleared and leveled",
        "water": "Would need well",
        "power": "At road (500ft run)",
        "access": "Maintained dirt road"
      },
      "zoning": "Agricultural",
      "highlights": [
        "Dark sky certified area",
        "Perfect for off-grid build",
        "Owner financing available",
        "No HOA or restrictions"
      ],
      "financing": {
        "ownerFinancing": true,
        "downPayment": "20%",
        "interestRate": "7%",
        "term": "10 years"
      },
      "keywords": ["parks", "land", "raw", "off-grid", "owner financing", "dark sky"]
    },
    {
      "id": "AZ-NAV-001",
      "name": "Red Rock Ranch",
      "price": 549000,
      "priceFormatted": "$549,000",
      "acreage": 80,
      "location": {
        "city": "Winslow",
        "county": "Navajo",
        "state": "AZ",
        "distance": "15 miles south of Winslow"
      },
      "features": {
        "structure": "Adobe home",
        "sqft": 2200,
        "bedrooms": 3,
        "bathrooms": 2,
        "water": "Well + 2 stock tanks",
        "power": "Grid electric",
        "extras": ["Barn", "Corrals", "Equipment shed"]
      },
      "zoning": "Ranch/Agricultural",
      "highlights": [
        "Working cattle ranch",
        "Historic Route 66 access",
        "Panoramic red rock views",
        "Income-producing potential"
      ],
      "keywords": ["winslow", "ranch", "cattle", "adobe", "route 66", "working ranch"]
    },
    {
      "id": "AZ-YAV-001",
      "name": "Verde Valley Vineyard Lot",
      "price": 225000,
      "priceFormatted": "$225,000",
      "acreage": 10,
      "location": {
        "city": "Camp Verde",
        "county": "Yavapai",
        "state": "AZ",
        "distance": "Central Verde Valley"
      },
      "features": {
        "structure": "Ready to build",
        "buildingSite": "Cleared pad",
        "water": "Existing well (15 GPM)",
        "power": "Grid electric at site",
        "irrigation": "Drip system installed"
      },
      "zoning": "Agricultural",
      "highlights": [
        "Arizona wine country",
        "Adjacent to producing vineyard",
        "Mild year-round climate",
        "Near Jerome and Sedona"
      ],
      "keywords": ["camp verde", "vineyard", "wine", "irrigated", "verde valley"]
    }
  ]
}
```

## Property Response Templates

### When Asked "What properties do you have?"

```
"We have five rural Arizona properties right now:

1. Mountain View Ranch near Flagstaff - 35 acres with a log cabin for $425,000
2. Ponderosa Homestead in Williams - 20 acres with a home and workshop for $289,000
3. High Desert Retreat in Parks - 40 acres of raw land for $175,000 with owner financing
4. Red Rock Ranch near Winslow - 80-acre working cattle ranch for $549,000
5. Verde Valley Vineyard Lot in Camp Verde - 10 irrigated acres for $225,000

Which of these sounds interesting, or would you like more details on any of them?"
```

### When Asked About a Specific Property

**AZ-FLAG-001 (Mountain View Ranch):**
```
"Mountain View Ranch is a beautiful 35-acre property about 15 miles east of Flagstaff. It has a 2-bedroom, 2-bath log cabin that's completely off-grid capable with solar panels and well water. The views of the San Francisco Peaks are incredible, and it's bordered by National Forest land. It's listed at $425,000. Would you like to schedule a showing?"
```

**AZ-FLAG-002 (Ponderosa Homestead):**
```
"The Ponderosa Homestead is in Williams, about 25 minutes from Flagstaff. It's 20 acres with an 1,800 square foot home - 3 bedrooms, 2 baths. There's also a detached workshop which is great for hobbies or a home business. The property is surrounded by ponderosa pines and you're only 30 minutes from the Grand Canyon. Asking $289,000. Want me to book a showing?"
```

**AZ-COC-001 (High Desert Retreat):**
```
"High Desert Retreat is 40 acres of raw land in Parks, which is about 20 miles west of Flagstaff. The building site is already cleared and leveled, and power is at the road. It's in a dark sky certified area, so the stargazing is unbelievable. Best part - the owner is offering financing with 20% down. Total price is $175,000. Interested in seeing it?"
```

**AZ-NAV-001 (Red Rock Ranch):**
```
"Red Rock Ranch is our largest property - 80 acres near Winslow. It's a working cattle ranch with an adobe home, 3 bedrooms, 2 baths. There's a barn, corrals, and two stock tanks for livestock. It's got those classic Arizona red rock views and historic Route 66 access. Listed at $549,000. This one goes fast - want to get on the schedule?"
```

**AZ-YAV-001 (Verde Valley Vineyard):**
```
"The Verde Valley Vineyard Lot is 10 irrigated acres in Camp Verde - that's Arizona wine country. There's an existing well doing 15 gallons per minute, drip irrigation already installed, and a cleared building pad ready for construction. You'd be neighbors with producing vineyards. It's $225,000 and perfect for someone wanting to get into the wine business. Should I book a viewing?"
```

## Handling Questions Not in Knowledge Base

If asked about:
- **Property taxes**: "I don't have the exact tax figures, but I can have our team send you that information. Want me to make a note of that?"
- **School districts**: "That's a great question for families. Let me transfer you to our team who can pull up the school district details."
- **Comparable sales**: "I'd want our team to give you accurate comp data. Should I connect you with them?"
- **Inspection reports**: "We can arrange for inspection reports as part of the showing process. Let me get you scheduled first."
