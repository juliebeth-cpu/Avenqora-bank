import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { publicInfo, publicTrack } from "@/lib/portal-api";
import { formatWebsiteCopyright, UNAVAILABLE } from "@/lib/site-display";
import TrackingJourneyMap from "@/components/tracking-journey-map";
import WebsiteLogo from "@/components/website-logo";
import AssetSlideshow from "@/components/AssetSlideshow";
import { TrackingLandingSections } from "@/pages/public/tracking-content";
import { PromoVideoEmbed, type PromoVideo } from "@/pages/public/generic-home";
import { DEFAULT_WEBSITE_THEME } from "@/lib/website-theme";
import {
  Search, MapPin, Clock, Plane, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, Package2, Maximize2, Minimize2,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

interface Props {
  params: { websiteUid: string };
  promoVideo?: PromoVideo | null;
}

/* ── Status helpers ──────────────────────────────────────────────────────────── */
const STATUS_STEPS = [
  "Shipment Registered",
  "Arrived at Origin Airport",
  "In Transit",
  "Arrived at Destination Airport",
  "Out for Delivery",
  "Delivered",
];

const STATUS_TO_STEP: Record<string, number> = {
  "Shipment Created": 0, "Shipment Registered": 0, "Shipment Received": 0,
  "Package Collected": 0, "Package Picked Up": 0,
  "Arrived at Origin Airport": 1, "At Origin Airport": 1, "Airport Security Check": 1,
  "Departed Airport": 1, "Arrived At Airport": 1,
  "At Local Warehouse": 2, "Processing Shipment": 2, "Ready For Dispatch": 2,
  "Dispatched": 2, "In Transit": 2, "Transit Hub": 2,
  "Flight Delayed": 2, "Flight Departed": 2,
  "Waiting For Customs": 2, "Customs Inspection": 2, "Customs Clearance": 2,
  "Customs Hold": 2, "Customs Released": 2, "Awaiting Duty Payment": 2,
  "Payment Pending": 2, "Payment Confirmed": 2, "Released From Customs": 2,
  "Arrived At Destination Airport": 3, "Arrived at Destination Airport": 3,
  "At Destination Airport": 3,
  "Transferred To Local Courier": 4, "At Distribution Center": 4,
  "Out For Delivery": 4, "Out for Delivery": 4, "Delivery Attempt": 4,
  "Receiver Not Available": 4, "Address Verification": 4,
  "Shipment Delayed": 2, "Shipment On Hold": 2,
  "Successfully Delivered": 5, "Final Delivery Completed": 5, "Delivered": 5,
  "Shipment Cancelled": -1,
};

function getStatusColor(status: string) {
  const sl = (status ?? "").toLowerCase();
  if (sl.includes("deliver") || sl.includes("complet")) return "#22c55e";
  if (sl.includes("cancel") || sl.includes("declined")) return "#ef4444";
  if (sl.includes("hold") || sl.includes("delay") || sl.includes("missing")) return "#f59e0b";
  if (sl.includes("return")) return "#a855f7";
  if (sl.includes("customs") || sl.includes("airport") || sl.includes("security")) return "#8b5cf6";
  if (sl.includes("transit") || sl.includes("flight") || sl.includes("dispatch")) return "#0ea5e9";
  if (sl.includes("pickup") || sl.includes("picked") || sl.includes("collect")) return "#3b82f6";
  return "#64748b";
}

/* ── Great-circle interpolation ─────────────────────────────────────────────── */
function interpolate(lat1: number, lng1: number, lat2: number, lng2: number, t: number) {
  const toRad = (d: number) => d * Math.PI / 180;
  const toDeg = (r: number) => r * 180 / Math.PI;
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const λ1 = toRad(lng1), λ2 = toRad(lng2);
  const dφ = φ2 - φ1, dλ = λ2 - λ1;
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  const d = 2 * Math.asin(Math.sqrt(a));
  if (d === 0) return { lat: lat1, lng: lng1 };
  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  return { lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), lng: toDeg(Math.atan2(y, x)) };
}

/* ── IATA airport coordinate database ───────────────────────────────────────── */
const AIRPORT_COORDS: Record<string, [number, number]> = {
  // North America – USA
  "JFK": [40.6413, -73.7781], "LAX": [33.9416, -118.4085], "ORD": [41.9742, -87.9073],
  "ATL": [33.6407, -84.4277], "DFW": [32.8998, -97.0403], "DEN": [39.8561, -104.6737],
  "SFO": [37.6213, -122.3790], "SEA": [47.4502, -122.3088], "LAS": [36.0840, -115.1537],
  "MCO": [28.4312, -81.3081], "MIA": [25.7959, -80.2870], "CLT": [35.2140, -80.9431],
  "EWR": [40.6895, -74.1745], "PHX": [33.4373, -112.0078], "IAH": [29.9902, -95.3368],
  "MSP": [44.8848, -93.2223], "BOS": [42.3656, -71.0096], "DTW": [42.2162, -83.3554],
  "PHL": [39.8744, -75.2424], "LGA": [40.7772, -73.8726], "FLL": [26.0726, -80.1527],
  "IAD": [38.9531, -77.4565], "BWI": [39.1754, -76.6682], "SLC": [40.7899, -111.9791],
  "MDW": [41.7868, -87.7522], "SAN": [32.7338, -117.1933], "TPA": [27.9755, -82.5332],
  "HNL": [21.3245, -157.9251], "PDX": [45.5898, -122.5951], "STL": [38.7487, -90.3700],
  "MCI": [39.2976, -94.7139], "OAK": [37.7213, -122.2208], "MSY": [29.9934, -90.2580],
  "SJC": [37.3626, -121.9290], "RDU": [35.8776, -78.7875], "SMF": [38.6954, -121.5908],
  "AUS": [30.1975, -97.6664], "CLE": [41.4117, -81.8498], "PIT": [40.4915, -80.2329],
  "IND": [39.7173, -86.2944], "CVG": [39.0488, -84.6678], "MKE": [42.9472, -87.8966],
  "ABQ": [35.0402, -106.6091], "BNA": [36.1245, -86.6782], "DAL": [32.8471, -96.8517],
  "HOU": [29.6454, -95.2789], "SNA": [33.6757, -117.8682], "MEM": [35.0424, -89.9767],
  "OKC": [35.3931, -97.6007], "JAX": [30.4941, -81.6879], "SAT": [29.5337, -98.4698],
  "RIC": [37.5052, -77.3197], "TUL": [36.1984, -95.8881], "PBI": [26.6832, -80.0956],
  "BDL": [41.9389, -72.6832], "GRR": [42.8808, -85.5228], "ALB": [42.7483, -73.8017],
  // Canada
  "YYZ": [43.6777, -79.6248], "YVR": [49.1947, -123.1792], "YUL": [45.4706, -73.7408],
  "YYC": [51.1215, -114.0076], "YEG": [53.3097, -113.5800], "YOW": [45.3225, -75.6692],
  "YHZ": [44.8808, -63.5086], "YWG": [49.9100, -97.2398],
  // Mexico
  "MEX": [19.4363, -99.0721], "CUN": [21.0365, -86.8770], "GDL": [20.5218, -103.3102],
  "MTY": [25.7749, -100.1077], "SJD": [23.1518, -109.7210], "PVR": [20.6801, -105.2544],
  "HMO": [29.0956, -111.0475], "MZT": [23.1614, -106.2661], "TIJ": [32.5411, -116.9700],
  "CUU": [28.7029, -105.9646], "TAM": [22.2964, -97.8659], "VER": [19.1459, -96.1873],
  "OAX": [16.9999, -96.7266], "MID": [20.9370, -89.6577], "CJS": [31.6361, -106.4287],
  "ZIH": [17.6016, -101.4605], "ZLO": [19.1448, -104.5588], "BJX": [20.9935, -101.4809],
  "AGU": [21.7056, -102.3181], "MLM": [19.8499, -101.0253], "PAZ": [20.6027, -97.4608],
  "CME": [18.6535, -91.7993], "MXL": [32.6306, -115.2417], "LTO": [25.9892, -111.3479],
  "ESE": [31.7953, -116.6026], "SRL": [23.4253, -110.6630], "CPE": [19.8167, -90.5003],
  // Central & South America
  "GRU": [-23.4356, -46.4731], "EZE": [-34.8222, -58.5358], "SCL": [-33.3930, -70.7858],
  "BOG": [4.7016, -74.1469], "LIM": [-12.0219, -77.1143], "UIO": [-0.1292, -78.5832],
  "CCS": [10.6031, -66.9905], "GIG": [-22.8099, -43.2505], "BSB": [-15.8711, -47.9186],
  "FOR": [-3.7763, -38.5326], "SSA": [-12.9086, -38.3225], "REC": [-8.1264, -34.9231],
  "MVD": [-34.8384, -56.0308], "ASU": [-25.2400, -57.5191], "GYE": [-2.1574, -79.8836],
  "PTY": [9.0714, -79.3835], "SJO": [9.9939, -84.2089], "GUA": [14.5833, -90.5275],
  "MGA": [12.1415, -86.1681], "SAP": [15.4526, -87.9236], "SDQ": [18.4297, -69.6689],
  "HAV": [22.9892, -82.4091], "MBJ": [18.5037, -77.9135], "SLU": [13.7333, -60.9527],
  // Europe
  "LHR": [51.4700, -0.4543], "CDG": [49.0097, 2.5479], "FRA": [50.0379, 8.5622],
  "AMS": [52.3086, 4.7639], "MAD": [40.4983, -3.5676], "FCO": [41.8003, 12.2389],
  "MUC": [48.3538, 11.7861], "BCN": [41.2974, 2.0833], "LGW": [51.1537, -0.1821],
  "ZRH": [47.4647, 8.5492], "VIE": [48.1103, 16.5697], "BRU": [50.9014, 4.4844],
  "CPH": [55.6180, 12.6561], "ARN": [59.6498, 17.9237], "HEL": [60.3172, 24.9633],
  "OSL": [60.2022, 11.0839], "DUB": [53.4214, -6.2700], "LIS": [38.7813, -9.1359],
  "ATH": [37.9364, 23.9445], "WAW": [52.1657, 20.9671], "BUD": [47.4298, 19.2611],
  "PRG": [50.1008, 14.2600], "VCE": [45.5053, 12.3519], "MXP": [45.6306, 8.7281],
  "GVA": [46.2380, 6.1089], "DUS": [51.2895, 6.7668], "HAM": [53.6304, 9.9882],
  "PMI": [39.5517, 2.7388], "EDI": [55.9500, -3.3725], "MAN": [53.3537, -2.2750],
  "STN": [51.8850, 0.2350], "LTN": [51.8747, -0.3683], "BHX": [52.4539, -1.7480],
  "NCE": [43.6584, 7.2159], "MRS": [43.4393, 5.2214], "LYS": [45.7256, 5.0811],
  "TXL": [52.5548, 13.2925], "SXF": [52.3800, 13.5225], "BER": [52.3667, 13.5033],
  "NAP": [40.8861, 14.2908], "CTA": [37.4668, 15.0664], "PMO": [38.1760, 13.0910],
  "BLQ": [44.5354, 11.2887], "FLR": [43.8100, 11.2051], "GOT": [57.6628, 12.2798],
  "BGO": [60.2934, 5.2184], "TRD": [63.4578, 10.9240], "RIX": [56.9236, 23.9711],
  "TLL": [59.4133, 24.8328], "VNO": [54.6341, 25.2858], "KBP": [50.3450, 30.8947],
  "SVO": [55.9726, 37.4146], "DME": [55.4088, 37.9063], "LED": [59.8003, 30.2625],
  "OTP": [44.5722, 26.1020], "SOF": [42.6952, 23.4114], "SKG": [40.5197, 22.9709],
  "HER": [35.3397, 25.1803], "RHO": [36.4054, 28.0862], "CFU": [39.6019, 19.9117],
  "LCA": [34.8751, 33.6249], "PFO": [34.7180, 32.4857], "TBS": [41.6692, 44.9547],
  "EVN": [40.1473, 44.3959], "GYD": [40.4675, 50.0467],
  // Middle East
  "ALP": [36.1807, 37.2244], "DXB": [25.2532, 55.3657], "AUH": [24.4330, 54.6511], "DOH": [25.2731, 51.6081],
  "KWI": [29.2267, 47.9689], "BAH": [26.2708, 50.6336], "MCT": [23.5933, 58.2844],
  "AMM": [31.7226, 35.9932], "BEY": [33.8209, 35.4883], "TLV": [32.0114, 34.8867],
  "IST": [41.2752, 28.7519], "SAW": [40.8987, 29.3092], "ESB": [40.1281, 32.9951],
  "RUH": [24.9576, 46.6988], "JED": [21.6805, 39.1565], "DMM": [26.4712, 49.7979],
  "MED": [24.5534, 39.7051], "BGW": [33.2625, 44.2346], "EBL": [36.2396, 43.9632],
  "DAM": [33.4111, 36.5156], "SHJ": [25.3286, 55.5172], "DWC": [24.8963, 55.1614],
  // Africa
  "CAI": [30.1219, 31.4056], "ADD": [8.9779, 38.7993], "NBO": [-1.3192, 36.9275],
  "JNB": [-26.1392, 28.2460], "CPT": [-33.9649, 18.6017], "CMN": [33.3675, -7.5898],
  "ALG": [36.6910, 3.2154], "TUN": [36.8510, 10.2272], "LOS": [6.5774, 3.3212],
  "ABV": [9.0068, 7.2632], "ACC": [5.6052, -0.1668], "DKR": [14.7397, -17.4902],
  "MPM": [-25.9207, 32.5726], "EBB": [0.0424, 32.4436], "MGQ": [2.0144, 45.3047],
  "HAR": [-17.9318, 31.0927], "LUN": [-15.3308, 28.4526], "DSS": [14.6700, -17.0744],
  "ROB": [6.2338, -10.3623], "BKO": [12.5335, -7.9495], "OUA": [12.3532, -1.5124],
  "ABJ": [5.2613, -3.9262], "DLA": [4.0061, 9.7195], "NSI": [3.7226, 11.5533],
  "KGL": [-1.9686, 30.1395], "DAR": [-6.8781, 39.2026], "MBA": [-4.0348, 39.5942],
  "HRE": [-17.9318, 31.0927], "MRU": [-20.4302, 57.6836], "TNR": [-18.7969, 47.4788],
  // South Asia
  "BOM": [19.0896, 72.8656], "DEL": [28.5665, 77.1031], "MAA": [12.9900, 80.1693],
  "BLR": [13.1986, 77.7066], "HYD": [17.2313, 78.4298], "CCU": [22.6547, 88.4467],
  "COK": [10.1520, 76.4019], "AMD": [23.0776, 72.6347], "CMB": [7.1808, 79.8841],
  "DAC": [23.8433, 90.3978], "KTM": [27.6966, 85.3591], "KHI": [24.9065, 67.1608],
  "LHE": [31.5216, 74.4036], "ISB": [33.6167, 73.0992], "KBL": [34.5659, 69.2123],
  "MLE": [4.1919, 73.5290], "GOI": [15.3808, 73.8314], "IXC": [30.6735, 76.7885],
  "JAI": [26.8242, 75.8122], "ATQ": [31.7096, 74.7973], "PNQ": [18.5822, 73.9197],
  "VNS": [25.4524, 82.8593],
  // Southeast Asia
  "BKK": [13.6811, 100.7473], "SIN": [1.3644, 103.9915], "KUL": [2.7456, 101.7072],
  "CGK": [-6.1255, 106.6559], "DPS": [-8.7467, 115.1670], "MNL": [14.5086, 121.0197],
  "SGN": [10.8184, 106.6519], "HAN": [21.2187, 105.8068], "RGN": [16.9073, 96.1332],
  "REP": [13.4107, 103.8132], "VTE": [17.9883, 102.5633], "PNH": [11.5466, 104.8440],
  "CEB": [10.3075, 123.9790], "DVO": [7.1255, 125.6458], "KNO": [3.6422, 98.8856],
  "SUB": [-7.3798, 112.7867], "UPG": [-5.0616, 119.5540], "HLP": [-6.2656, 106.8908],
  "DMK": [13.9126, 100.6070], "CNX": [18.7677, 98.9628], "HDY": [6.9332, 100.3929],
  "PEN": [5.2977, 100.2767], "KCH": [1.4847, 110.3428], "BKI": [5.9371, 116.0508],
  // East Asia
  "PEK": [40.0799, 116.6031], "PVG": [31.1443, 121.8083], "CAN": [23.3925, 113.2988],
  "SZX": [22.6393, 113.8107], "CTU": [30.5785, 103.9469], "HGH": [30.2291, 120.4340],
  "XIY": [34.4471, 108.7519], "CKG": [29.7192, 106.6416], "KMG": [24.9924, 102.7433],
  "WUH": [30.7838, 114.2081], "NKG": [31.7421, 118.8620], "TSN": [39.1244, 117.3464],
  "CSX": [28.1892, 113.2196], "TAO": [36.2661, 120.3745], "HRB": [45.6235, 126.2502],
  "SHE": [41.6398, 123.4839], "SYX": [18.3029, 109.4122], "FOC": [25.9352, 119.6630],
  "HND": [35.5494, 139.7798], "NRT": [35.7647, 140.3864], "KIX": [34.4272, 135.2440],
  "ITM": [34.7854, 135.4382], "NGO": [34.8583, 136.8050], "CTS": [42.7752, 141.6922],
  "FUK": [33.5853, 130.4511], "OKA": [26.1958, 127.6461], "HIJ": [34.4361, 132.9194],
  "SDJ": [38.1397, 140.9170], "KMJ": [32.8373, 130.8553],
  "ICN": [37.4602, 126.4407], "GMP": [37.5585, 126.7942], "PUS": [35.1795, 128.9381],
  "CJU": [33.5113, 126.4930], "TAE": [35.8941, 128.6589],
  "HKG": [22.3080, 113.9185], "MFM": [22.1496, 113.5920],
  "TPE": [25.0777, 121.2330], "KHH": [22.5771, 120.3497],
  "ULN": [47.8431, 106.7664],
  // Oceania
  "SYD": [-33.9399, 151.1753], "MEL": [-37.6690, 144.8410], "BNE": [-27.3842, 153.1175],
  "PER": [-31.9403, 115.9669], "ADL": [-34.9452, 138.5308], "CBR": [-35.3069, 149.1950],
  "DRW": [-12.4147, 130.8765], "CNS": [-16.8858, 145.7450], "OOL": [-28.1644, 153.5044],
  "AKL": [-37.0082, 174.7917], "CHC": [-43.4894, 172.5322], "WLG": [-41.3272, 174.8050],
  "NAN": [-17.7554, 177.4432], "APW": [-13.8300, -172.0080], "NOU": [-22.0146, 166.2130],
  "POM": [-9.4432, 147.2200], "HIR": [-9.4280, 160.0547], "SUV": [-18.0433, 178.5594],
};

/* ── Progress along route per shipment status (0 = origin, 1 = destination) ── */
const STATUS_PROGRESS: Record<string, number> = {
  "Shipment Created":              0.01,
  "Shipment Registered":           0.01,
  "Shipment Received":             0.01,
  "Package Collected":             0.04,
  "Package Picked Up":             0.04,
  "At Local Warehouse":            0.07,
  "Processing Shipment":           0.07,
  "Ready For Dispatch":            0.09,
  "Dispatched":                    0.11,
  "Arrived at Origin Airport":     0.13,
  "At Origin Airport":             0.13,
  "Arrived At Airport":            0.13,
  "Airport Security Check":        0.15,
  "Departed Airport":              0.18,
  "Flight Departed":               0.18,
  "In Transit":                    0.50,
  "Transit Hub":                   0.54,
  "Flight Delayed":                0.50,
  "Shipment Delayed":              0.50,
  "Shipment On Hold":              0.50,
  "Waiting For Customs":           0.72,
  "Customs Inspection":            0.73,
  "Customs Clearance":             0.75,
  "Customs Hold":                  0.73,
  "Customs Released":              0.77,
  "Awaiting Duty Payment":         0.74,
  "Payment Pending":               0.74,
  "Payment Confirmed":             0.77,
  "Payment Declined":              0.74,
  "Released From Customs":         0.80,
  "Arrived At Destination Airport":0.86,
  "Arrived at Destination Airport":0.86,
  "Transferred To Local Courier":  0.89,
  "At Distribution Center":        0.91,
  "Out For Delivery":              0.94,
  "Out for Delivery":              0.94,
  "Delivery Attempt":              0.96,
  "Receiver Not Available":        0.96,
  "Address Verification":          0.96,
  "Successfully Delivered":        1.00,
  "Final Delivery Completed":      1.00,
  "Delivered":                     1.00,
  "Shipment Returned":             0.20,
  "Returned To Sender":            0.10,
  "Shipment Cancelled":            0.00,
  "Shipment Missing":              0.50,
  "Shipment Damaged":              0.50,
};

function extractIATA(s?: string | null): string {
  if (!s) return "";
  // Match leading 3-letter IATA code like "JFK" or "JFK — ..." or "✈ JFK"
  const m = s.trim().match(/(?:^|✈\s*)([A-Z]{3})(?:\b|$|[\s—–-])/);
  return m ? m[1] : "";
}

function getAirportCoords(airportStr?: string | null): [number, number] | null {
  if (!airportStr) return null;
  const iata = extractIATA(airportStr);
  if (iata && AIRPORT_COORDS[iata]) return AIRPORT_COORDS[iata];
  // Try raw 3-letter uppercase match anywhere in string
  const match = airportStr.match(/\b([A-Z]{3})\b/g);
  if (match) {
    for (const code of match) {
      if (AIRPORT_COORDS[code]) return AIRPORT_COORDS[code];
    }
  }
  return null;
}

function getProgressFromStatus(status?: string | null): number {
  if (!status) return 0.01;
  if (STATUS_PROGRESS[status] !== undefined) return STATUS_PROGRESS[status];
  // Fuzzy fallback
  const sl = status.toLowerCase();
  if (sl.includes("delivered") || sl.includes("complet")) return 1.0;
  if (sl.includes("out for delivery") || sl.includes("distribution")) return 0.93;
  if (sl.includes("destination airport") || sl.includes("customs")) return 0.80;
  if (sl.includes("transit") || sl.includes("flight")) return 0.50;
  if (sl.includes("origin airport") || sl.includes("departed")) return 0.15;
  if (sl.includes("register") || sl.includes("created")) return 0.01;
  return 0.30;
}

/* ── Bearing between two lat/lng points (for rotating the airplane) ────────── */
function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => d * Math.PI / 180;
  const dLng = toRad(lng2 - lng1);
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const y = Math.sin(dLng) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function getRouteBearing(
  from: [number, number],
  to: [number, number],
  progress: number,
  currentPosition?: { lat: number; lng: number },
) {
  const t = Math.max(0, Math.min(1, progress));
  const position = currentPosition ?? interpolate(from[0], from[1], to[0], to[1], t);
  const sample = 0.001;

  // At the destination, look back along the final segment instead of asking
  // bearing() for the direction from the destination to itself.
  if (t >= 1) {
    const previous = interpolate(from[0], from[1], to[0], to[1], Math.max(0, t - sample));
    return bearing(previous.lat, previous.lng, position.lat, position.lng);
  }

  const ahead = interpolate(from[0], from[1], to[0], to[1], Math.min(1, t + sample));
  return bearing(position.lat, position.lng, ahead.lat, ahead.lng);
}

function getTimeSchedule(flight: any, shipment: any) {
  const departureMs = flight?.departureTime
    ? new Date(flight.departureTime).getTime()
    : shipment?.departureAt
      ? new Date(shipment.departureAt).getTime()
      : null;
  const expectedArrivalMs = shipment?.expectedArrivalAt
    ? new Date(shipment.expectedArrivalAt).getTime()
    : null;
  const durationMs = flight?.transitHours
    ? Number(flight.transitHours) * 3600_000
    : shipment?.journeyDurationMinutes
      ? Number(shipment.journeyDurationMinutes) * 60_000
      : departureMs != null && expectedArrivalMs != null && expectedArrivalMs > departureMs
        ? expectedArrivalMs - departureMs
        : null;
  const status = String(shipment?.status ?? "").toLowerCase();
  const shipmentIsMoving = !flight && (
    status.includes("transit") ||
    status.includes("departed") ||
    status.includes("delivery") ||
    status.includes("delivered")
  );
  const active = Boolean(
    departureMs != null &&
    durationMs != null &&
    Number.isFinite(departureMs) &&
    Number.isFinite(durationMs) &&
    durationMs > 0 &&
    (flight?.status === "in_flight" || shipmentIsMoving),
  );

  return { departureMs, durationMs, active };
}

/* ── Satellite + Labels Leaflet Map ─────────────────────────────────────────── */
function WorldFlightMap({ flight, shipment }: { flight?: any; shipment?: any }) {
  const mapDivRef    = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapObjRef    = useRef<L.Map | null>(null);
  const planeRef     = useRef<L.Marker | null>(null);
  const progressRef  = useRef<number>(-1);       // current animated progress
  const routeRef     = useRef<{ from: [number,number]; to: [number,number] } | null>(null);
  const animRef      = useRef<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  /* ── Create map once on mount ──────────────────────────────────────────── */
  useEffect(() => {
    if (!mapDivRef.current || mapObjRef.current) return;
    delete (L.Icon.Default.prototype as any)._getIconUrl;

    const map = L.map(mapDivRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
      minZoom: 2,
      maxZoom: 18,
    }).setView([25, 10], 2);

    // Satellite imagery
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution:
          "Tiles &copy; Esri &mdash; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
        maxZoom: 18,
      }
    ).addTo(map);

    // Labels overlay
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 18, opacity: 1 }
    ).addTo(map);

    mapObjRef.current = map;

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      map.remove();
      mapObjRef.current  = null;
      planeRef.current   = null;
      routeRef.current   = null;
      progressRef.current = -1;
    };
  }, []);

  /* ── Draw route + place airplane when coordinates are resolved ──────────── */
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map) return;

    // Resolve departure coordinates: flight lat/lng first, then IATA lookup
    let depLat = Number(flight?.departureLat);
    let depLng = Number(flight?.departureLng);
    let arrLat = Number(flight?.arrivalLat);
    let arrLng = Number(flight?.arrivalLng);

    const depFromFlight = flight && !isNaN(depLat) && depLat !== 0 && !isNaN(depLng) && depLng !== 0;
    const arrFromFlight = flight && !isNaN(arrLat) && arrLat !== 0 && !isNaN(arrLng) && arrLng !== 0;

    const depFromShipment = !depFromFlight &&
      Number.isFinite(Number(shipment?.originLatitude)) &&
      Number.isFinite(Number(shipment?.originLongitude));
    const arrFromShipment = !arrFromFlight &&
      Number.isFinite(Number(shipment?.destinationLatitude)) &&
      Number.isFinite(Number(shipment?.destinationLongitude));

    if (depFromShipment) {
      depLat = Number(shipment.originLatitude);
      depLng = Number(shipment.originLongitude);
    } else if (!depFromFlight) {
      const c = getAirportCoords(flight?.departureAirport)
             ?? getAirportCoords(shipment?.originAirport);
      if (c) { depLat = c[0]; depLng = c[1]; }
    }
    if (arrFromShipment) {
      arrLat = Number(shipment.destinationLatitude);
      arrLng = Number(shipment.destinationLongitude);
    } else if (!arrFromFlight) {
      const c = getAirportCoords(flight?.arrivalAirport)
             ?? getAirportCoords(shipment?.destinationAirport);
      if (c) { arrLat = c[0]; arrLng = c[1]; }
    }

    if (![depLat, depLng, arrLat, arrLng].every(Number.isFinite)) return;

    const from: [number, number] = [depLat, depLng];
    const to:   [number, number] = [arrLat, arrLng];
    routeRef.current = { from, to };

    // Remove old route lines and markers (keep tile layers)
    map.eachLayer(layer => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });
    planeRef.current = null;

    // Draw great-circle arc (120 points)
    const arc: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const p = interpolate(from[0], from[1], to[0], to[1], i / 120);
      arc.push([p.lat, p.lng]);
    }
    L.polyline(arc, { color: "#ffffff", weight: 2.5, dashArray: "10 6", opacity: 0.85 }).addTo(map);

    // Origin dot (green)
    L.marker(from, {
      icon: L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.8)"></div>`,
        className: "", iconSize: [14, 14], iconAnchor: [7, 7],
      }),
    }).bindTooltip(
      `<b>✈ Origin</b><br>${[
        flight?.departureCity || shipment?.originCity,
        flight?.departureCountry || shipment?.originCountry,
      ].filter(Boolean).join(", ") || "Origin"}${(flight?.departureAirport || shipment?.originAirport) ? `<br><code>${flight?.departureAirport || shipment?.originAirport}</code>` : ""}`,
      { permanent: false }
    ).addTo(map);

    // Destination dot (red)
    L.marker(to, {
      icon: L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.8)"></div>`,
        className: "", iconSize: [14, 14], iconAnchor: [7, 7],
      }),
    }).bindTooltip(
      `<b>🏁 Destination</b><br>${[
        flight?.arrivalCity || shipment?.destinationCity,
        flight?.arrivalCountry || shipment?.destinationCountry,
      ].filter(Boolean).join(", ") || "Destination"}${(flight?.arrivalAirport || shipment?.destinationAirport) ? `<br><code>${flight?.arrivalAirport || shipment?.destinationAirport}</code>` : ""}`,
      { permanent: false }
    ).addTo(map);

    // ── Determine initial airplane position ──────────────────────────────────
    // Priority 1: time-based schedule (transitHours + departureTime, flight in_flight)
    // Priority 2: explicit currentLat/currentLng override
    // Priority 3: status-progress fallback
    const { departureMs: scheduleDepMs, durationMs: scheduleTotalMs, active: hasSchedule } =
      getTimeSchedule(flight, shipment);

    const curLat = Number(flight?.currentLat);
    const curLng = Number(flight?.currentLng);
    const hasCurrentPos = !isNaN(curLat) && !isNaN(curLng) && (curLat !== 0 || curLng !== 0);

    let targetT: number;
    let initPos: { lat: number; lng: number };

    if (hasSchedule) {
      // Time-based: aircraft is at the exact position elapsed-time dictates
      targetT = Math.max(0, Math.min(1, (Date.now() - scheduleDepMs!) / scheduleTotalMs!));
      initPos = interpolate(from[0], from[1], to[0], to[1], targetT);
    } else if (hasCurrentPos) {
      targetT = getProgressFromStatus(shipment?.status);
      initPos = { lat: curLat, lng: curLng };
    } else {
      targetT = getProgressFromStatus(shipment?.status);
      initPos = interpolate(from[0], from[1], to[0], to[1], targetT);
    }

    // Compute rotation angle along route
    const rotDeg = getRouteBearing(from, to, targetT, hasSchedule ? undefined : initPos);

    const makePlaneHtml = (deg: number) =>
      `<div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;transform:rotate(${deg}deg)">` +
      `<svg width="28" height="28" viewBox="0 0 24 24" fill="#000000" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 0 3px #fff) drop-shadow(0 0 6px rgba(255,255,255,0.6))">` +
      `<path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>` +
      `</svg></div>`;

    planeRef.current = L.marker([initPos.lat, initPos.lng], {
      icon: L.divIcon({
        html: makePlaneHtml(rotDeg),
        className: "", iconSize: [32, 32], iconAnchor: [16, 16],
      }),
      zIndexOffset: 1000,
    }).bindTooltip(
      `<b>${flight?.flightNumber ? `Flight ${flight.flightNumber}` : "Shipment in transit"}</b>${flight?.airline ? `<br>${flight.airline}` : ""}${shipment?.status ? `<br>Status: ${shipment.status}` : ""}`,
      { permanent: false }
    ).addTo(map);

    progressRef.current = targetT;

    // Fit map to route
    map.fitBounds(L.latLngBounds([from, to]), { padding: [60, 60], maxZoom: 7 });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Re-draw route only when coordinates or key identifiers change
    flight?.departureLat, flight?.departureLng,
    flight?.arrivalLat, flight?.arrivalLng,
    flight?.departureAirport, flight?.arrivalAirport,
    flight?.currentLat, flight?.currentLng,
    flight?.transitHours, flight?.departureTime,
     flight?.status,
    shipment?.originAirport, shipment?.destinationAirport,
     shipment?.originLatitude, shipment?.originLongitude,
     shipment?.destinationLatitude, shipment?.destinationLongitude,
     shipment?.departureAt, shipment?.journeyDurationMinutes,
     shipment?.status,
    shipment?.originCity, shipment?.destinationCity,
    shipment?.id,
  ]);

  /* ── Continuous time-based animation when flight schedule is set ─────────── */
  useEffect(() => {
    const plane = planeRef.current;
    const rc    = routeRef.current;
    if (!plane || !rc) return;

    const { departureMs: depMs, durationMs: totalMs, active: hasSchedule } =
      getTimeSchedule(flight, shipment);

    // Only run time-based loop when: schedule is set, flight is in_flight, times are valid
    if (!hasSchedule || depMs == null || totalMs == null) return;
    // Freeze animation when administrator has paused, cancelled, or declared emergency
    // (plane stays at server-persisted currentLat/Lng instead of time-advancing)
    if ((flight as any)?.overrideMode === "paused" ||
        (flight as any)?.overrideMode === "cancelled" ||
        (flight as any)?.overrideMode === "emergency") return;

    const { from, to } = rc;
    let rafId: number;
    // Throttle DOM updates: only move the marker when position shifts by ≥ 0.00005° (~5 m)
    let lastUpdateT = progressRef.current < 0 ? -1 : progressRef.current;

    const tick = () => {
      const t = Math.max(0, Math.min(1, (Date.now() - depMs) / totalMs));

      if (Math.abs(t - lastUpdateT) >= 0.00005 || lastUpdateT < 0) {
        lastUpdateT = t;
        progressRef.current = t;

        const pos   = interpolate(from[0], from[1], to[0], to[1], t);
        const deg   = getRouteBearing(from, to, t);

        plane.setLatLng([pos.lat, pos.lng]);

        const el = plane.getElement?.();
        if (el) {
          const inner = el.querySelector("div") as HTMLElement | null;
          if (inner) inner.style.transform = `rotate(${deg}deg)`;
        }
      }

      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => { if (rafId) cancelAnimationFrame(rafId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    flight?.departureTime,
    flight?.transitHours,
    flight?.status,
    flight?.departureLat, flight?.departureLng,
    flight?.arrivalLat, flight?.arrivalLng,
    flight?.departureAirport, flight?.arrivalAirport,
     shipment?.departureAt,
     shipment?.journeyDurationMinutes,
     shipment?.status,
    shipment?.id,
  ]);

  /* ── Animate airplane to new position when status changes (no-schedule fallback) */
  useEffect(() => {
    const plane = planeRef.current;
    const rc    = routeRef.current;
    if (!plane || !rc) return;

    // Skip status-based animation when time-based schedule is active
    const { active: hasSchedule } = getTimeSchedule(flight, shipment);
    if (hasSchedule) return;

    const targetT = getProgressFromStatus(shipment?.status);
    const startT  = progressRef.current;
    if (startT < 0 || Math.abs(targetT - startT) < 0.001) return;

    if (animRef.current) cancelAnimationFrame(animRef.current);

    const DURATION = 3500;
    const startTime = performance.now();
    const { from, to } = rc;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const frac    = Math.min(1, elapsed / DURATION);
      // Ease-in-out cubic
      const ease  = frac < 0.5 ? 4 * frac ** 3 : 1 - (-2 * frac + 2) ** 3 / 2;
      const t     = startT + (targetT - startT) * ease;
      progressRef.current = t;

      const pos   = interpolate(from[0], from[1], to[0], to[1], t);
      const deg   = getRouteBearing(from, to, t);

      plane.setLatLng([pos.lat, pos.lng]);
      // Update rotation
      const el = plane.getElement?.();
      if (el) {
        const inner = el.querySelector("div") as HTMLElement | null;
        if (inner) inner.style.transform = `rotate(${deg}deg)`;
      }

      if (frac < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        progressRef.current = targetT;
        if (animRef.current) cancelAnimationFrame(animRef.current);
      }
    };

    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight?.departureTime, flight?.transitHours, flight?.status, shipment?.departureAt, shipment?.journeyDurationMinutes, shipment?.status]);

  /* ── Fullscreen handling ─────────────────────────────────────────────────── */
  useEffect(() => {
    const h = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  const toggleFs = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) containerRef.current.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        overflow: "hidden",
        boxShadow: "0 4px 32px rgba(0,0,0,0.5)",
      }}
    >
      <div
        ref={mapDivRef}
        style={{ width: "100%", height: fullscreen ? "100vh" : "clamp(320px, 45vw, 520px)" }}
      />
      <button
        onClick={toggleFs}
        title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
        style={{
          position: "absolute", bottom: 44, right: 10, zIndex: 1000,
          background: "rgba(255,255,255,0.95)", border: "2px solid rgba(0,0,0,0.2)",
          borderRadius: 4, padding: "5px 9px", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 5,
          fontSize: 11, fontWeight: 600, color: "#333",
          boxShadow: "0 1px 5px rgba(0,0,0,0.3)", lineHeight: 1,
        }}
      >
        {fullscreen
          ? <><Minimize2 style={{ width: 11, height: 11 }} /> Exit</>
          : <><Maximize2 style={{ width: 11, height: 11 }} /> Fullscreen</>}
      </button>
    </div>
  );
}

/* ── How To Track section ────────────────────────────────────────────────────── */
function HowToTrack() {
  const steps = [
    { n: "1", text: "Enter your Tracking Number." },
    { n: "2", text: "Click Track Shipment." },
    { n: "3", text: "View your live shipment location, shipment history, shipment facts and estimated delivery." },
  ];
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16,
      padding: "28px 28px 24px",
      maxWidth: 680,
      margin: "0 auto",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <div style={{ width: 3, height: 20, background: "#3b82f6", borderRadius: 2 }} />
        <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          How to Track
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {steps.map(({ n, text }) => (
          <div key={n} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "rgba(59,130,246,0.15)",
              border: "1px solid rgba(59,130,246,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 14 }}>{n}</span>
            </div>
            <p style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.6, margin: "4px 0 0" }}>{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Status step label (short) ───────────────────────────────────────────────── */
const STEP_LABELS_SHORT = ["Registered", "Origin Airport", "In Transit", "Dest. Airport", "Out for Delivery", "Delivered"];

/* ── Fact row ────────────────────────────────────────────────────────────────── */
function FactRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      alignItems: "flex-start", padding: "11px 0",
      borderBottom: "1px solid rgba(255,255,255,0.05)", gap: 16,
    }}>
      <span style={{ color: "#64748b", fontSize: 13, flexShrink: 0, width: 160 }}>{label}</span>
      <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 500, textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

/* ── Section card ────────────────────────────────────────────────────────────── */
function SectionCard({ title, icon, iconColor, children }: {
  title: string; icon: React.ReactNode; iconColor: string; children: React.ReactNode
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.035)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16, padding: "20px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ color: iconColor }}>{icon}</span>
        <h2 style={{
          color: "#94a3b8", fontWeight: 700, fontSize: 11,
          textTransform: "uppercase", letterSpacing: "0.1em", margin: 0,
        }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────────── */
export default function PublicTrackingPage({ params, promoVideo }: Props) {
  const { websiteUid } = params;

  // Pre-fill from ?t=TRACKING_NUMBER query param (enables shareable tracking links)
  const initialTracking = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("t") ?? ""
    : "";

  const [input, setInput]                   = useState(initialTracking);
  const [trackingNumber, setTrackingNumber] = useState(initialTracking);
  const [showAllEvents, setShowAllEvents]   = useState(false);

  const { data: info } = useQuery({
    queryKey: ["publicInfo", websiteUid],
    queryFn: () => publicInfo(websiteUid),
    retry: false,
    staleTime: 60_000,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["track", websiteUid, trackingNumber],
    queryFn: () => publicTrack(websiteUid, trackingNumber),
    enabled: !!trackingNumber,
    retry: false,
    // Auto-refresh: use flight's configured update interval (minutes → ms), else 20 s default
    refetchInterval: (query) => {
      if (!trackingNumber) return false;
      const d = query.state.data as any;
      const mins = d?.flight?.updateIntervalMinutes;
      return (mins && mins > 0) ? mins * 60_000 : 20_000;
    },
    refetchIntervalInBackground: false,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const t = input.trim();
    if (t) { setTrackingNumber(t); setShowAllEvents(false); }
  };

  const siteName = info?.name ?? info?.website?.name ?? UNAVAILABLE;
  const logoUrl  = info?.logoUrl ?? info?.website?.logoUrl ?? null;
  const websiteType = info?.type ?? info?.website?.type;
  const theme = (info?.theme as any) ?? DEFAULT_WEBSITE_THEME;
  const primary = theme.primary ?? info?.primaryColor ?? info?.website?.primaryColor ?? "#3b82f6";
  const pageBackground = theme.background ?? "#080c18";
  const pageHeader = theme.header ?? "rgba(8,12,24,0.92)";
  const pageCard = theme.card ?? "rgba(255,255,255,0.04)";
  const pageBorder = theme.border ?? "rgba(255,255,255,0.07)";
  const pageText = theme.text ?? "#f8fafc";
  const pageMuted = theme.mutedText ?? "#94a3b8";

  const shipment        = data?.shipment;
  const flight          = data?.flight;
  const journey         = data?.shipment?.journeySimulation;
  const events          = data?.events ?? [];
  const stops           = data?.stops ?? [];
  const visibleEvents   = showAllEvents ? events : events.slice(0, 5);
  const statusIdx       = shipment
    ? (STATUS_TO_STEP[shipment.status]
      ?? (shipment.status?.toLowerCase().includes("at destination airport") ? 3 : 0))
    : -1;
  const originLabel     = [shipment?.originCity, shipment?.originCountry].filter(Boolean).join(", ") || "—";
  const destLabel       = [shipment?.destinationCity, shipment?.destinationCountry].filter(Boolean).join(", ") || "—";
  const hasResult       = !!data && !isError && !!shipment;
  const currentLocation = journey?.currentLocation
    ? [journey.currentLocation.name, journey.currentLocation.code ? `(${journey.currentLocation.code})` : null]
      .filter(Boolean).join(" ")
    : events[0]
      ? [events[0].city, events[0].country, events[0].airport ? `✈ ${events[0].airport}` : null].filter(Boolean).join(", ") || events[0].location
      : null;
  const liveSchedule = getTimeSchedule(flight, shipment);
  // Package Tracking progress is server-authoritative. The legacy flight
  // schedule fallback must not replace a routed/stopped journey percentage.
  const liveProgress = journey?.progress
    ?? (liveSchedule.active && liveSchedule.departureMs != null && liveSchedule.durationMs != null
      ? Math.max(0, Math.min(1, (Date.now() - liveSchedule.departureMs) / liveSchedule.durationMs))
      : 0);
  const mapFallback = useMemo(() => {
    const coordinate = (latitude: unknown, longitude: unknown) => {
      if (latitude == null || longitude == null || latitude === "" || longitude === "") return null;
      const lat = Number(latitude), lng = Number(longitude);
      return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] as [number, number] : null;
    };
    const origin = coordinate(shipment?.originLatitude, shipment?.originLongitude)
      ?? getAirportCoords(shipment?.originAirport);
    const destination = coordinate(shipment?.destinationLatitude, shipment?.destinationLongitude)
      ?? getAirportCoords(shipment?.destinationAirport);
    const stopWaypoints = stops
      .filter((stop: any) => coordinate(stop.latitude, stop.longitude))
      .map((stop: any) => ({
        name: stop.name || stop.locationIdentifier || stop.city || "Stopover",
        stopId: stop.id,
        city: stop.city ?? null,
        country: stop.country ?? null,
        countryCode: stop.countryCode ?? null,
        locationIdentifier: stop.locationIdentifier ?? null,
        latitude: Number(stop.latitude),
        longitude: Number(stop.longitude),
      }));
    const route = origin && destination
      ? [
          {
            name: [shipment?.originCity, shipment?.originCountry].filter(Boolean).join(", ") || shipment?.originAirport || "Origin",
            city: shipment?.originCity ?? null,
            country: shipment?.originCountry ?? null,
            countryCode: shipment?.originCountryCode ?? null,
            locationIdentifier: shipment?.originAirport ?? null,
            latitude: origin[0], longitude: origin[1],
          },
          ...stopWaypoints,
          {
            name: [shipment?.destinationCity, shipment?.destinationCountry].filter(Boolean).join(", ") || shipment?.destinationAirport || "Destination",
            city: shipment?.destinationCity ?? null,
            country: shipment?.destinationCountry ?? null,
            countryCode: shipment?.destinationCountryCode ?? null,
            locationIdentifier: shipment?.destinationAirport ?? null,
            latitude: destination[0], longitude: destination[1],
          },
        ]
      : [];
    const schedule = getTimeSchedule(flight, shipment);
    return {
      route,
      transportType: shipment?.transportType ?? (flight ? "flight" : null),
      schedule: {
        departureAt: shipment?.departureAt ?? flight?.departureTime ?? null,
        durationMinutes: schedule.durationMs != null ? schedule.durationMs / 60_000 : null,
        active: schedule.active,
      },
      completedStopIds: journey?.completedStopIds ?? [],
    };
  }, [
    flight?.departureTime, flight?.transitHours, flight?.status,
    shipment?.originAirport, shipment?.originLatitude, shipment?.originLongitude,
    shipment?.destinationAirport, shipment?.destinationLatitude, shipment?.destinationLongitude,
    shipment?.originCity, shipment?.originCountry, shipment?.destinationCity, shipment?.destinationCountry,
    shipment?.transportType, shipment?.departureAt, shipment?.expectedArrivalAt,
    shipment?.journeyDurationMinutes, shipment?.status,
    journey?.completedStopIds, stops,
  ]);

  return (
    <div style={{
      minHeight: "100vh",
      background: pageBackground,
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: pageText,
    }}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: pageHeader,
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${pageBorder}`,
        padding: "0 24px",
        height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {logoUrl
            ? websiteType === "tracking"
              ? <img src={logoUrl} alt={siteName} style={{ height: 36, width: "auto", objectFit: "contain" }} />
              : <WebsiteLogo src={logoUrl} alt={siteName} size={36} />
            : (
              <div style={{
                width: 36, height: 36, borderRadius: websiteType === "tracking" ? 8 : "50%",
                background: primary,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 16, color: "#fff",
              }}>
                {siteName.charAt(0).toUpperCase()}
              </div>
            )
          }
          <span style={{ color: pageText, fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em" }}>
            {siteName}
          </span>
        </div>
        {hasResult && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: pageCard,
            border: `1px solid ${pageBorder}`,
            borderRadius: 8, padding: "5px 12px",
          }}>
            <Package2 style={{ width: 13, height: 13, color: primary }} />
            <span style={{ color: pageMuted, fontSize: 12, fontFamily: "monospace" }}>
              {shipment?.trackingNumber}
            </span>
          </div>
        )}
      </header>

      {/* ── Hero / Search ─────────────────────────────────────────────────────── */}
      <div style={{
        background: hasResult
          ? "rgba(255,255,255,0.015)"
          : "linear-gradient(180deg, rgba(59,130,246,0.06) 0%, transparent 100%)",
        borderBottom: hasResult ? "1px solid rgba(255,255,255,0.06)" : "none",
        padding: hasResult ? "20px 24px" : "56px 24px 48px",
        transition: "padding 0.3s ease",
        position: "relative",
        overflow: "hidden",
      }}>
        {!hasResult && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.42,
              pointerEvents: "none",
            }}
          >
            <AssetSlideshow
              className="h-full w-full"
              intervalMs={4300}
              overlay="linear-gradient(180deg, rgba(8,12,24,0.35), rgba(8,12,24,0.96))"
              label={`${siteName} logistics hero slideshow`}
              variant="logistics"
              priority
            />
          </div>
        )}
        <div style={{ maxWidth: 680, margin: "0 auto", position: "relative", zIndex: 1 }}>
          {!hasResult && (
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                background: "rgba(59,130,246,0.12)",
                border: "1px solid rgba(59,130,246,0.2)",
                borderRadius: 20, padding: "5px 14px", marginBottom: 20,
              }}>
                 <Package2 style={{ width: 13, height: 13, color: "#60a5fa" }} />
                <span style={{ color: "#60a5fa", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em" }}>
                  LIVE CARGO TRACKING
                </span>
              </div>
              <h1 style={{
                fontSize: "clamp(28px, 5vw, 44px)",
                fontWeight: 800,
                margin: "0 0 12px",
                letterSpacing: "-0.03em",
                background: "linear-gradient(135deg, #f1f5f9 0%, #94a3b8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                Track Your Shipment
              </h1>
              <p style={{ color: "#64748b", fontSize: 15, margin: 0, lineHeight: 1.6 }}>
                Enter your tracking number to get live status updates,<br />
                timeline, and delivery details.
              </p>
            </div>
          )}

          {/* Search bar */}
          <form onSubmit={handleSearch} style={{ display: "flex", gap: 10 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search style={{
                position: "absolute", left: 15, top: "50%",
                transform: "translateY(-50%)",
                width: 17, height: 17, color: "#475569", pointerEvents: "none",
              }} />
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Enter tracking number…"
                autoComplete="off"
                style={{
                  width: "100%", boxSizing: "border-box",
                  height: 52, paddingLeft: 44, paddingRight: 16,
                  background: `${theme.card ?? "rgba(255,255,255,0.06)"}`,
                  border: `1.5px solid ${theme.border ?? "rgba(255,255,255,0.1)"}`,
                  borderRadius: 12, color: pageText,
                  fontSize: 15, fontFamily: "monospace",
                  outline: "none", letterSpacing: "0.04em",
                  transition: "border-color 0.2s",
                }}
                onFocus={e => (e.target.style.borderColor = primary + "99")}
                onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              style={{
                height: 52, padding: "0 26px",
                background: isLoading ? "#1e3a5f" : primary,
                border: "none", borderRadius: 12,
                color: "#fff", fontWeight: 700, fontSize: 14,
                cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 8,
                flexShrink: 0, transition: "opacity 0.2s, background 0.2s",
                opacity: !input.trim() ? 0.6 : 1,
                letterSpacing: "0.01em",
              }}
            >
              {isLoading
                ? <>
                    <Plane style={{ width: 16, height: 16, animation: "flightPulse 1s ease-in-out infinite" }} />
                    Searching…
                  </>
                : <>
                    <Search style={{ width: 15, height: 15 }} />
                    Track Shipment
                  </>
              }
            </button>
          </form>

          {/* Error state */}
          {isError && !isLoading && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "14px 16px", marginTop: 14,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 12,
            }}>
              <AlertCircle style={{ width: 17, height: 17, color: "#f87171", flexShrink: 0, marginTop: 1 }} />
              <p style={{ color: "#fca5a5", fontSize: 14, margin: 0 }}>
                Tracking number not found. Please check the number and try again.
              </p>
            </div>
          )}

          {!hasResult && promoVideo?.placement === "hero" && (
            <div style={{ marginTop: 28 }}>
              <PromoVideoEmbed video={promoVideo} primary={primary} />
            </div>
          )}
        </div>
      </div>

      {/* ── How To Track (shown only when no result) ──────────────────────────── */}
      {!hasResult && !isLoading && (
        <div style={{ padding: "40px 24px 56px" }}>
          <HowToTrack />
        </div>
      )}
      {!hasResult && !isLoading && promoVideo?.placement === "about" && (
        <section style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 32px" }}>
          <PromoVideoEmbed video={promoVideo} primary={primary} />
        </section>
      )}
      {!hasResult && !isLoading && info && (
        <TrackingLandingSections
          websiteUid={websiteUid}
          siteName={siteName}
          primary={primary}
        />
      )}
      {!hasResult && !isLoading && promoVideo?.placement === "featured" && (
        <section style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 40px" }}>
          <PromoVideoEmbed video={promoVideo} primary={primary} />
        </section>
      )}

      {/* ── Results ───────────────────────────────────────────────────────────── */}
      {hasResult && (
        <div>
          {/* Live map — full width */}
            <TrackingJourneyMap
              simulation={journey}
              fallback={mapFallback}
              journeyType={shipment?.journeyType}
              websiteType={info?.type ?? info?.website?.type}
              photoUrl={shipment?.trackingImageUrl}
            />

          {/* Content below map */}
          <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 20px 56px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {shipment?.trackingImageUrl && (
                <div style={{ display: "flex", gap: 16, alignItems: "center", padding: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16 }}>
                  <img src={shipment.trackingImageUrl} alt={shipment.journeyType === "human" ? "Traveler" : "Package"} style={{ width: 104, height: 104, objectFit: "cover", borderRadius: 12, border: "1px solid rgba(255,255,255,.12)" }} />
                  <div>
                    <p style={{ margin: "0 0 5px", color: "#94a3b8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em" }}>{shipment.journeyType === "human" ? "Traveler" : "Package"}</p>
                    <p style={{ margin: 0, color: "#f8fafc", fontSize: 15 }}>Verified journey photo</p>
                  </div>
                </div>
              )}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16, padding: 16,
              }}>
                {[
                  ["Transport", shipment.transportType ?? "—"],
                  ["Authoritative status", journey?.status ?? shipment.journeyStatus],
                    ["Progress", `${Math.round(liveProgress * 100)}%`],
                  ["Current location", journey?.currentLocation?.name ?? "—"],
                  ["Estimated arrival", journey?.estimatedArrivalAt ? new Date(journey.estimatedArrivalAt).toLocaleString() : "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", margin: "0 0 4px" }}>{label}</p>
                    <p style={{ color: "#f8fafc", fontWeight: 600, fontSize: 13, margin: 0 }}>{value}</p>
                  </div>
                ))}
              </div>
              {(journey?.hold || journey?.delayMinutes > 0) && (
                <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.22)", color: "#fcd34d", fontSize: 13 }}>
                  {journey?.hold ? `Journey holding${journey.hold.reason ? `: ${journey.hold.reason}` : ""}` : `Journey delayed by ${journey.delayMinutes} minutes`}
                </div>
              )}
              {shipment.journeyDetails && (
                <SectionCard title="Journey Information" icon={<Package2 style={{ width: 14, height: 14 }} />} iconColor="#60a5fa">
                  {shipment.journeyDetails.transportDetails && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                      {Object.entries(shipment.journeyDetails.transportDetails).filter(([, value]) => value != null && value !== "").map(([key, value]) => (
                        <span key={key} style={{ color: "#cbd5e1", fontSize: 12, padding: "5px 8px", borderRadius: 6, background: "rgba(255,255,255,.04)" }}>
                          {key.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase())}: {String(value)}
                        </span>
                      ))}
                    </div>
                  )}
                  {shipment.journeyDetails.cargo && <FactRow label="Cargo / luggage" value={[shipment.journeyDetails.cargo.category, shipment.journeyDetails.cargo.description, shipment.journeyDetails.cargo.quantity ? `×${shipment.journeyDetails.cargo.quantity}` : null].filter(Boolean).join(" · ")} />}
                  {shipment.journeyDetails.traveler && <FactRow label="Traveler / passenger" value={[shipment.journeyDetails.traveler.name, shipment.journeyDetails.traveler.seat ? `Seat ${shipment.journeyDetails.traveler.seat}` : null].filter(Boolean).join(" · ")} />}
                  {shipment.journeyDetails.instructions?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <p style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", margin: "0 0 5px" }}>Instructions</p>
                      <ul style={{ color: "#cbd5e1", fontSize: 12, margin: 0, paddingLeft: 18 }}>
                        {shipment.journeyDetails.instructions.map((instruction: any, index: number) => <li key={index}>{typeof instruction === "string" ? instruction : instruction.text}</li>)}
                      </ul>
                    </div>
                  )}
                </SectionCard>
              )}

              {/* Status bar */}
              <div style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16, padding: "20px 22px",
              }}>
                {/* Tracking number + status */}
                <div style={{
                  display: "flex", flexWrap: "wrap",
                  justifyContent: "space-between", gap: 12, marginBottom: 22,
                }}>
                  <div>
                    <p style={{
                      color: "#475569", fontSize: 10, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px",
                    }}>Tracking Number</p>
                    <p style={{
                      color: "#f1f5f9", fontFamily: "monospace",
                      fontWeight: 700, fontSize: 18, margin: "0 0 2px",
                      letterSpacing: "0.04em",
                    }}>{shipment.trackingNumber}</p>
                    {shipment.referenceNumber && (
                      <p style={{ color: "#475569", fontSize: 12, margin: 0 }}>
                        Ref: {shipment.referenceNumber}
                      </p>
                    )}
                    {events[0] && (
                      <p style={{ color: "#64748b", fontSize: 12, margin: "4px 0 0" }}>
                        Updated: {new Date(events[0].eventTime).toLocaleString("en-US", {
                          month: "short", day: "numeric", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{
                      color: "#475569", fontSize: 10, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 6px",
                    }}>Status</p>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "6px 14px", borderRadius: 99, fontSize: 13, fontWeight: 700,
                      background: getStatusColor(shipment.status) + "1a",
                      color: getStatusColor(shipment.status),
                      border: `1px solid ${getStatusColor(shipment.status)}35`,
                      letterSpacing: "0.01em",
                    }}>
                      <Plane style={{ width: 12, height: 12 }} />
                      {shipment.status}
                    </span>
                    {shipment.estimatedDelivery && (
                      <p style={{ color: "#64748b", fontSize: 12, margin: "6px 0 0" }}>
                        ETA: {new Date(shipment.estimatedDelivery).toLocaleDateString("en-US", {
                          month: "long", day: "numeric", year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Progress stepper */}
                <div style={{ overflowX: "auto", paddingBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", minWidth: 420 }}>
                    {STATUS_STEPS.map((step, i) => {
                      const done = statusIdx >= i;
                      const cur  = statusIdx === i;
                      const last = i === STATUS_STEPS.length - 1;
                      return (
                        <div key={step} style={{
                          display: "flex", flexDirection: "column",
                          alignItems: "center", flex: last ? "0 0 auto" : 1,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                            {i > 0 && (
                              <div style={{
                                flex: 1, height: 2,
                                background: done ? primary : "rgba(255,255,255,0.07)",
                                transition: "background 0.3s",
                              }} />
                            )}
                            <div style={{
                              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: done ? primary : "rgba(255,255,255,0.05)",
                              border: `2px solid ${done ? primary : "rgba(255,255,255,0.1)"}`,
                              boxShadow: cur ? `0 0 0 4px ${primary}25` : "none",
                              transition: "all 0.3s",
                            }}>
                              {done
                                ? (last
                                    ? <CheckCircle style={{ width: 12, height: 12, color: "#fff" }} />
                                    : <Plane style={{ width: 11, height: 11, color: "#fff" }} />)
                                : <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#334155" }} />
                              }
                            </div>
                            {!last && (
                              <div style={{
                                flex: 1, height: 2,
                                background: statusIdx > i ? primary : "rgba(255,255,255,0.07)",
                                transition: "background 0.3s",
                              }} />
                            )}
                          </div>
                          <p style={{
                            fontSize: 10, marginTop: 7, textAlign: "center", lineHeight: 1.3,
                            color: done ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)",
                            maxWidth: 70,
                          }}>
                            {STEP_LABELS_SHORT[i]}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Route — From / To */}
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr auto 1fr",
                  alignItems: "center", gap: 12, marginTop: 20,
                  padding: "16px 0 0", borderTop: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <div>
                    <p style={{ color: "#475569", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>From</p>
                    <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14, margin: "0 0 2px" }}>{originLabel}</p>
                    {(flight?.departureAirport || shipment?.originAirport) && (
                      <p style={{ color: "#64748b", fontSize: 12, display: "flex", alignItems: "center", gap: 4, margin: 0 }}>
                        <Plane style={{ width: 10, height: 10 }} />
                        {flight?.departureAirport ?? shipment?.originAirport}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 20, height: 1, background: "#1e293b" }} />
                    <Plane style={{ width: 14, height: 14, color: "#334155" }} />
                    <div style={{ width: 20, height: 1, background: "#1e293b" }} />
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ color: "#475569", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>To</p>
                    <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14, margin: "0 0 2px" }}>{destLabel}</p>
                    {(flight?.arrivalAirport || shipment?.destinationAirport) && (
                      <p style={{ color: "#64748b", fontSize: 12, display: "flex", alignItems: "center", gap: 4, margin: 0, justifyContent: "flex-end" }}>
                        <Plane style={{ width: 10, height: 10 }} />
                        {flight?.arrivalAirport ?? shipment?.destinationAirport}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Shipment History */}
              {events.length > 0 && (
                <SectionCard
                  title="Shipment History"
                  icon={<Clock style={{ width: 14, height: 14 }} />}
                  iconColor="#60a5fa"
                >
                  {visibleEvents.map((ev: any, i: number) => (
                    <div key={i} style={{ display: "flex", gap: 12 }}>
                      <div style={{
                        display: "flex", flexDirection: "column",
                        alignItems: "center", width: 28, flexShrink: 0,
                      }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: "50%",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: getStatusColor(ev.status) + "15",
                          border: `1.5px solid ${getStatusColor(ev.status)}35`,
                          zIndex: 1, flexShrink: 0,
                        }}>
                          <Plane style={{ width: 11, height: 11, color: getStatusColor(ev.status) }} />
                        </div>
                        {i < visibleEvents.length - 1 && (
                          <div style={{
                            width: 1, flex: 1, margin: "3px 0",
                            background: "rgba(255,255,255,0.05)", minHeight: 16,
                          }} />
                        )}
                      </div>
                      <div style={{ paddingBottom: 16, flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{
                              color: i === 0 ? "#f1f5f9" : "#cbd5e1",
                              fontWeight: i === 0 ? 700 : 600,
                              fontSize: 14, margin: "0 0 2px", lineHeight: 1.3,
                            }}>{ev.status}</p>
                            {(ev.city || ev.country || ev.location || ev.airport) && (
                              <p style={{
                                color: "#64748b", fontSize: 12,
                                display: "flex", alignItems: "center", gap: 3,
                                margin: "0 0 1px",
                              }}>
                                <MapPin style={{ width: 10, height: 10, flexShrink: 0 }} />
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {[ev.city, ev.country, ev.airport ? `✈ ${ev.airport}` : null]
                                    .filter(Boolean).join(", ") || ev.location}
                                </span>
                              </p>
                            )}
                            {ev.description && (
                              <p style={{ color: "#475569", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                                {ev.description}
                              </p>
                            )}
                            {i === 0 && (
                              <span style={{
                                display: "inline-block", marginTop: 5,
                                background: "rgba(59,130,246,0.15)",
                                border: "1px solid rgba(59,130,246,0.25)",
                                color: "#60a5fa", fontSize: 10, fontWeight: 700,
                                padding: "2px 8px", borderRadius: 4,
                                letterSpacing: "0.05em", textTransform: "uppercase",
                              }}>Current Location</span>
                            )}
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <p style={{ color: "#475569", fontSize: 11, margin: 0, lineHeight: 1.5 }}>
                              {new Date(ev.eventTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                            <p style={{ color: "#334155", fontSize: 11, margin: 0 }}>
                              {new Date(ev.eventTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {events.length > 5 && (
                    <button
                      onClick={() => setShowAllEvents(v => !v)}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        color: "#60a5fa", fontSize: 13, fontWeight: 600,
                        background: "none", border: "none",
                        cursor: "pointer", padding: "4px 0", marginTop: 4,
                      }}
                    >
                      {showAllEvents
                        ? <><ChevronUp style={{ width: 13, height: 13 }} /> Show fewer</>
                        : <><ChevronDown style={{ width: 13, height: 13 }} /> View all {events.length} events</>
                      }
                    </button>
                  )}
                </SectionCard>
              )}

              {/* Shipment Facts */}
              <SectionCard
                title="Shipment Facts"
                icon={<Package2 style={{ width: 14, height: 14 }} />}
                iconColor="#a78bfa"
              >
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <FactRow label="Tracking Number"    value={shipment.trackingNumber} />
                  <FactRow label="Reference Number"   value={shipment.referenceNumber} />
                  <FactRow label="Current Status"     value={shipment.status} />
                  <FactRow label="Journey Status"     value={shipment.journeyStatus} />
                  <FactRow label="Transport"          value={shipment.transportType} />
                  <FactRow label="Current Location"   value={currentLocation} />
                  <FactRow label="Service Type"       value={shipment.serviceType ?? shipment.carrier ?? undefined} />
                  <FactRow label="Estimated Delivery" value={
                    shipment.estimatedDelivery
                      ? new Date(shipment.estimatedDelivery).toLocaleDateString("en-US", {
                          weekday: "long", month: "long", day: "numeric", year: "numeric",
                        })
                      : undefined
                  } />
                  <FactRow label="Sender"             value={shipment.senderName ?? undefined} />
                  <FactRow label="Recipient"          value={shipment.recipientName ?? undefined} />
                  <FactRow label="Origin"             value={originLabel !== "—" ? originLabel : undefined} />
                  <FactRow label="Destination"        value={destLabel !== "—" ? destLabel : undefined} />
                  <FactRow label="Weight"             value={shipment.weight ?? undefined} />
                  <FactRow label="Dimensions"         value={shipment.dimensions ?? undefined} />
                  <FactRow label="Package Type"       value={shipment.packageDescription ?? undefined} />
                </div>
              </SectionCard>

              {stops.length > 0 && (
                <SectionCard title="Journey Stops" icon={<MapPin style={{ width: 14, height: 14 }} />} iconColor="#60a5fa">
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    {stops.map((stop: any) => (
                      <div key={stop.id} style={{ display: "flex", gap: 10, padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <span style={{ color: "#60a5fa", fontFamily: "monospace", fontSize: 12, minWidth: 24 }}>#{stop.stopOrder}</span>
                        <div>
                          <p style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600, margin: 0 }}>{stop.name}</p>
                      <p style={{ color: "#64748b", fontSize: 12, margin: "3px 0 0" }}>{[stop.city, stop.region, stop.country].filter(Boolean).join(", ")}</p>
                      {stop.instructions && <p style={{ color: "#94a3b8", fontSize: 12, margin: "3px 0 0" }}>{stop.instructions}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Flight Route (if flight data exists) */}
              {flight && (flight.flightNumber || flight.airline || flight.departureAirport || flight.arrivalAirport) && (
                <SectionCard
                  title="Flight Route"
                  icon={<Plane style={{ width: 14, height: 14 }} />}
                  iconColor="#34d399"
                >
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <FactRow label="Flight Number"     value={flight.flightNumber} />
                    <FactRow label="Airline"           value={flight.airline} />
                    <FactRow label="Departure Airport" value={
                      [flight.departureAirport, flight.departureCity, flight.departureCountry]
                        .filter(Boolean).join(" — ")
                    } />
                    <FactRow label="Arrival Airport"   value={
                      [flight.arrivalAirport, flight.arrivalCity, flight.arrivalCountry]
                        .filter(Boolean).join(" — ")
                    } />
                    <FactRow label="Departure Time"    value={
                      flight.departureTime
                        ? new Date(flight.departureTime).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
                        : undefined
                    } />
                    <FactRow label="Arrival Time"      value={
                      flight.arrivalTime
                        ? new Date(flight.arrivalTime).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
                        : undefined
                    } />
                    <FactRow label="Flight Status"     value={flight.status} />
                  </div>
                </SectionCard>
              )}

              {/* Track another */}
              <div style={{ textAlign: "center", paddingTop: 8 }}>
                <button
                  onClick={() => { setTrackingNumber(""); setInput(""); setShowAllEvents(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  style={{
                    background: "none", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10, color: "#64748b", fontSize: 13,
                    fontWeight: 600, padding: "10px 22px", cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "#94a3b8"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#64748b"; }}
                >
                  Track Another Shipment
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.05)",
        padding: "20px 24px",
      }}>
        <div style={{
          maxWidth: 1152,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}>
          <p style={{ color: "#334155", fontSize: 12, margin: 0 }}>
            {formatWebsiteCopyright(siteName, info?.launchDate, info?.createdAt)}
          </p>
          <nav style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12 }} aria-label="Tracking website links">
            <a href={`/site/${websiteUid}/blog`} style={{ color: "#64748b", textDecoration: "none" }}>Blog</a>
            <a href={`/site/${websiteUid}/privacy`} style={{ color: "#64748b", textDecoration: "none" }}>Privacy Policy</a>
            <a href={`/site/${websiteUid}/terms`} style={{ color: "#64748b", textDecoration: "none" }}>Terms &amp; Conditions</a>
          </nav>
        </div>
      </footer>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes flightPulse {
          0%, 100% { opacity: 0.55; transform: translateX(-2px); }
          50% { opacity: 1; transform: translateX(2px); }
        }
        * { box-sizing: border-box; }
        input::placeholder { color: #334155; }
        .leaflet-control-zoom { border: none !important; }
        .leaflet-control-zoom a { background: rgba(255,255,255,0.93) !important; color: #333 !important; border-bottom: 1px solid rgba(0,0,0,0.1) !important; }
      `}</style>
    </div>
  );
}
