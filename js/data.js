// ==================== AIRCRAFT DB ====================
export const aircraftDB = Object.freeze([
    { id:0, name:"Cessna 208", price:28000, capacity:12, range:1200, speed:340, image:"🛩️", fuelBurn:0.9, weightClass:"light", airportFee:180, baseTicketPrice:0.14, upgradeSlots:2 },
    { id:1, name:"ATR 72-600", price:62000, capacity:68, range:1500, speed:510, image:"✈️", fuelBurn:3.5, weightClass:"medium", airportFee:450, baseTicketPrice:0.12, upgradeSlots:3 },
    { id:2, name:"Embraer E175", price:95000, capacity:88, range:2200, speed:890, image:"✈️", fuelBurn:4.8, weightClass:"medium", airportFee:600, baseTicketPrice:0.11, upgradeSlots:3 },
    { id:3, name:"Boeing 737-800", price:135000, capacity:162, range:5400, speed:840, image:"🛫", fuelBurn:12.5, weightClass:"heavy", airportFee:1300, baseTicketPrice:0.10, upgradeSlots:4 },
    { id:4, name:"Airbus A320neo", price:165000, capacity:180, range:6500, speed:830, image:"🛫", fuelBurn:12.0, weightClass:"heavy", airportFee:1400, baseTicketPrice:0.10, upgradeSlots:4 },
    { id:5, name:"Boeing 787-8", price:300000, capacity:242, range:13500, speed:900, image:"🛬", fuelBurn:18.5, weightClass:"heavy", airportFee:2200, baseTicketPrice:0.09, upgradeSlots:5 },
    { id:6, name:"Airbus A380", price:550000, capacity:500, range:15000, speed:900, image:"🛬", fuelBurn:33.0, weightClass:"heavy", airportFee:3800, baseTicketPrice:0.08, upgradeSlots:5 }
]);

// ==================== AIRCRAFT UPGRADES ====================
export const aircraftUpgrades = Object.freeze([
    { id: 'capacity', name: '📦 Extra Seats', cost: 15000, effect: { capacity: 15 }, maxLevel: 3 },
    { id: 'range', name: '📡 Extended Range', cost: 12000, effect: { range: 500 }, maxLevel: 2 },
    { id: 'efficiency', name: '⛽ Fuel Efficiency', cost: 18000, effect: { fuelBurn: -0.15 }, maxLevel: 3 },
    { id: 'speed', name: '🚀 Speed Boost', cost: 10000, effect: { speed: 50 }, maxLevel: 2 }
]);

// ==================== CITIES ====================
export const baseCities = Object.freeze([
    { id:"SOF", name:"Sofia", lat:42.6977, lon:23.3219, maxSlots:3, level:1, upgradeCost:10000, upgradeTo:5, type:"mountain", region:"europe" },
    { id:"LON", name:"London", lat:51.5074, lon:-0.1278, maxSlots:8, level:1, upgradeCost:20000, upgradeTo:12, type:"city", region:"europe" },
    { id:"PAR", name:"Paris", lat:48.8566, lon:2.3522, maxSlots:7, level:1, upgradeCost:15000, upgradeTo:10, type:"city", region:"europe" },
    { id:"BER", name:"Berlin", lat:52.5200, lon:13.4050, maxSlots:6, level:1, upgradeCost:12000, upgradeTo:9, type:"city", region:"europe" },
    { id:"ROM", name:"Rome", lat:41.9028, lon:12.4964, maxSlots:5, level:1, upgradeCost:10000, upgradeTo:8, type:"beach", region:"europe" },
    { id:"MAD", name:"Madrid", lat:40.4168, lon:-3.7038, maxSlots:5, level:1, upgradeCost:10000, upgradeTo:8, type:"city", region:"europe" },
    { id:"ATH", name:"Athens", lat:37.9838, lon:23.7275, maxSlots:4, level:1, upgradeCost:8000, upgradeTo:6, type:"beach", region:"europe" },
    { id:"IST", name:"Istanbul", lat:41.0082, lon:28.9784, maxSlots:6, level:1, upgradeCost:12000, upgradeTo:9, type:"beach", region:"europe" },
    { id:"AMS", name:"Amsterdam", lat:52.3676, lon:4.9041, maxSlots:7, level:1, upgradeCost:15000, upgradeTo:10, type:"city", region:"europe" },
    { id:"VIE", name:"Vienna", lat:48.2082, lon:16.3738, maxSlots:5, level:1, upgradeCost:10000, upgradeTo:7, type:"city", region:"europe" },
    { id:"BCN", name:"Barcelona", lat:41.3851, lon:2.1734, maxSlots:6, level:1, upgradeCost:12000, upgradeTo:8, type:"beach", region:"europe" },
    { id:"MUC", name:"Munich", lat:48.1351, lon:11.5820, maxSlots:5, level:1, upgradeCost:10000, upgradeTo:7, type:"mountain", region:"europe" }
]);

export const extraCities = Object.freeze([
    { id:"DXB", name:"Dubai", lat:25.2048, lon:55.2708, maxSlots:10, level:1, upgradeCost:25000, upgradeTo:15, type:"city", region:"asia", minLevel:5 },
    { id:"BKK", name:"Bangkok", lat:13.7367, lon:100.5231, maxSlots:8, level:1, upgradeCost:20000, upgradeTo:12, type:"beach", region:"asia", minLevel:5 },
    { id:"SIN", name:"Singapore", lat:1.3521, lon:103.8198, maxSlots:9, level:1, upgradeCost:22000, upgradeTo:14, type:"city", region:"asia", minLevel:5 },
    { id:"JNB", name:"Johannesburg", lat:-26.2041, lon:28.0473, maxSlots:6, level:1, upgradeCost:15000, upgradeTo:9, type:"city", region:"africa", minLevel:6 },
    { id:"CAI", name:"Cairo", lat:30.0444, lon:31.2357, maxSlots:5, level:1, upgradeCost:12000, upgradeTo:8, type:"city", region:"africa", minLevel:5 }
]);

// ==================== SEASONS ====================
export const seasons = Object.freeze([
    { name: "🌸 Spring", months: [3,4,5], bonuses: { beach: 1.1, city: 1.0, mountain: 0.9 } },
    { name: "☀️ Summer", months: [6,7,8], bonuses: { beach: 1.3, city: 1.1, mountain: 0.8 } },
    { name: "🍂 Autumn", months: [9,10,11], bonuses: { beach: 0.9, city: 1.0, mountain: 1.1 } },
    { name: "❄️ Winter", months: [12,1,2], bonuses: { beach: 0.7, city: 1.0, mountain: 1.3 } }
]);

// ==================== ACHIEVEMENTS ====================
export const achievementsDB = Object.freeze([
    { id:0, name:"First Flight", desc:"Complete first flight", reward:1000, condition:(s)=>s.totalFlights>=1 },
    { id:1, name:"Sky Explorer", desc:"10 flights", reward:5000, condition:(s)=>s.totalFlights>=10 },
    { id:2, name:"Veteran", desc:"50 flights", reward:25000, condition:(s)=>s.totalFlights>=50 },
    { id:3, name:"First Aircraft", desc:"Buy first aircraft", reward:2000, condition:(s)=>s.aircrafts.length>=1 },
    { id:4, name:"Fleet Commander", desc:"5 aircraft", reward:15000, condition:(s)=>s.aircrafts.length>=5 },
    { id:5, name:"Millionaire", desc:"€1M revenue", reward:100000, condition:(s)=>s.totalRevenue>=1000000 },
    { id:6, name:"Long Haul", desc:"2000km route", reward:8000, condition:(s)=>s.longHaulCompleted===true },
    { id:7, name:"Airport Tycoon", desc:"Upgrade airport", reward:10000, condition:(s)=>s.anyUpgrade===true },
    { id:8, name:"Hub Master", desc:"Set a hub", reward:15000, condition:(s)=>s.hubSet===true },
    { id:9, name:"Global Explorer", desc:"Reach Level 5", reward:50000, condition:(s)=>s.companyLevel>=5 }
]);