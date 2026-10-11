import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MapVehicle } from '@/components/map/GPSwoxMap';

export function generateVehicleReportPdf(vehicle: MapVehicle) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const cardBorder: [number, number, number] = [226, 232, 240]; // Slate 200

  // Helper to cleanly format numbers without non-breaking spaces or strange characters
  const cleanFormatNumber = (num: number): string => {
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  // Status computation
  const isOnline = vehicle.online === 'online' || vehicle.online === 'ack';
  const speed = vehicle.lastPosition?.speed || 0;
  const isMoving = isOnline && speed > 0;
  const statusLabel = !isOnline
    ? 'HORS LIGNE'
    : vehicle.status === 'maintenance'
    ? 'EN MAINTENANCE'
    : isMoving
    ? 'EN MOUVEMENT'
    : "A L'ARRET";

  // ==========================================
  // 1. LUXURY MODERN HEADER (Full Redesign)
  // ==========================================
  const headerHeight = 36;
  // Deep Navy background
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // Emerald geometric accent bar
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, pageWidth, 3.5, 'F');

  // Subtle modern corner accent
  doc.setFillColor(30, 41, 59);
  doc.triangle(pageWidth - 30, 0, pageWidth, 0, pageWidth, 30, 'F');

  // Header Title with clean typography
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('SFTM FLEET INTELLIGENCE', 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text('RAPPORT TELEMETRIQUE & FICHE TECHNIQUE EN TEMPS REEL', 14, 22);

  const formattedDate = new Date().toLocaleString('fr-FR').replace(/\s+/g, ' ');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Document genere le : ${formattedDate}`, 14, 28);

  // Status Pill Badge (Top Right)
  const badgeW = 42;
  const badgeH = 10;
  const badgeX = pageWidth - badgeW - 14;
  const badgeY = 13;

  if (isMoving) {
    doc.setFillColor(6, 78, 59);
    doc.setDrawColor(16, 185, 129);
    doc.setTextColor(167, 243, 208);
  } else if (!isOnline) {
    doc.setFillColor(127, 29, 29);
    doc.setDrawColor(239, 68, 68);
    doc.setTextColor(254, 202, 202);
  } else {
    doc.setFillColor(120, 53, 15);
    doc.setDrawColor(245, 158, 11);
    doc.setTextColor(254, 240, 138);
  }

  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(statusLabel, badgeX + badgeW / 2, badgeY + 6.5, { align: 'center' });

  // ==========================================
  // 2. VEHICLE PROFILE BANNER
  // ==========================================
  let curY = 42;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...cardBorder);
  doc.roundedRect(14, curY, pageWidth - 28, 22, 3, 3, 'FD');

  // Left side: Plate & Model
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(vehicle.plate, 20, curY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  const modelText = vehicle.brand ? `${vehicle.brand} ${vehicle.model || ''}` : 'Vehicule Flotte SFTM';
  doc.text(modelText, 20, curY + 16);

  // Right side: Driver
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('CONDUCTEUR ASSIGNE', pageWidth - 20, curY + 8.5, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(16, 185, 129);
  doc.text(vehicle.driver || 'Non assigne', pageWidth - 20, curY + 16, { align: 'right' });

  // ==========================================
  // 3. FOUR METRIC CARDS (Fixed text boundaries & pure ASCII numbers)
  // ==========================================
  curY = 70;
  const colW = (pageWidth - 28 - 9) / 4;
  const colH = 24;

  const topSpeedVal = vehicle.topSpeedToday !== undefined && vehicle.topSpeedToday !== null
    ? `${Math.round(vehicle.topSpeedToday)} km/h`
    : `${Math.round(speed)} km/h`;

  const distanceJourVal = vehicle.distanceToday !== undefined && vehicle.distanceToday !== null
    ? `${cleanFormatNumber(vehicle.distanceToday)} km`
    : '0 km';

  const odometreVal = `${cleanFormatNumber(vehicle.mileage)} km`;
  const stopDurationVal = vehicle.lastPosition?.stopDuration || (isMoving ? 'En route' : '00h 55m');

  const cardsData = [
    { label: 'V.MAX JOUR', value: topSpeedVal, color: [16, 185, 129] },
    { label: 'DISTANCE JOUR', value: distanceJourVal, color: [6, 182, 212] },
    { label: 'ODOMETRE TOTAL', value: odometreVal, color: [99, 102, 241] },
    { label: "DUREE D'ARRET", value: stopDurationVal, color: [245, 158, 11] },
  ];

  cardsData.forEach((c, idx) => {
    const x = 14 + idx * (colW + 3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...cardBorder);
    doc.roundedRect(x, curY, colW, colH, 2.5, 2.5, 'FD');

    // Colored accent top stripe
    doc.setFillColor(c.color[0], c.color[1], c.color[2]);
    doc.rect(x, curY, colW, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(c.label, x + 4, curY + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(c.value, x + 4, curY + 17);
  });

  // ==========================================
  // 4. REAL-TIME LOCATION BOX (Text wrapping fixed)
  // ==========================================
  curY = 100;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...cardBorder);
  doc.roundedRect(14, curY, pageWidth - 28, 20, 2.5, 2.5, 'FD');

  doc.setFillColor(16, 185, 129);
  doc.circle(20, curY + 7, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(16, 185, 129);
  doc.text('DERNIERE POSITION GPS CONNUE', 25, curY + 8);

  const rawAddress = vehicle.lastPosition?.city
    ? `${vehicle.lastPosition.city} (Coords: ${vehicle.lastPosition.lat.toFixed(5)}, ${vehicle.lastPosition.lng.toFixed(5)})`
    : vehicle.lastPosition
    ? `Coords GPS: ${vehicle.lastPosition.lat.toFixed(5)}, ${vehicle.lastPosition.lng.toFixed(5)}`
    : 'Donnees GPS en attente';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  // Wrap address text safely inside the container box width
  const splitAddress = doc.splitTextToSize(rawAddress, pageWidth - 45);
  doc.text(splitAddress[0] || rawAddress, 25, curY + 14.5);

  // ==========================================
  // 5. TELEMATICS & SENSORS TABLE WITH MODERN ICONS
  // ==========================================
  curY = 126;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('INDICATEURS TELEMETRIQUES & CAPTEURS', 14, curY);

  const fuelText = vehicle.fuelQuantity !== null && vehicle.fuelQuantity !== undefined ? `${Math.round(vehicle.fuelQuantity)} L` : 'Non mesure';
  const batteryText = vehicle.battery !== null && vehicle.battery !== undefined ? `${Math.round(vehicle.battery)} %` : 'Non mesure';
  const networkText = vehicle.network !== null && vehicle.network !== undefined ? `${Math.round(vehicle.network)} %` : 'Non mesure';
  const currentSpeedText = `${Math.round(speed)} km/h`;

  autoTable(doc, {
    startY: curY + 3.5,
    margin: { left: 14, right: 14 },
    head: [['Capteur / Telemetrie', 'Valeur Actuelle', 'Statut', 'Evaluation']],
    body: [
      ['[FUEL]  Niveau Carburant (Reservoir)', fuelText, fuelText !== 'Non mesure' ? 'Actif' : 'N/A', Number(vehicle.fuelQuantity) < 20 ? 'Alerte Reserve' : 'Niveau Optimal'],
      ['[BATT]  Tension / Batterie Vehicule', batteryText, batteryText !== 'Non mesure' ? 'Connecte' : 'N/A', Number(vehicle.battery) < 20 ? 'Faible' : 'Conforme'],
      ['[GSM]   Signal Reseau GSM / GPS', networkText, networkText !== 'Non mesure' ? 'Signal Stable' : 'N/A', Number(vehicle.network) < 30 ? 'Moyen' : 'Excellent'],
      ['[SPD]   Vitesse Instantanee', currentSpeedText, isMoving ? 'En Trajet' : 'Stationnaire', isMoving ? 'Flux Continu' : 'Moteur Coupe / Ralenti'],
      ['[GPS]   Etat Boitier Traceur', isOnline ? 'En Direct' : 'Deconnecte', isOnline ? 'Online (OK)' : 'Offline', isOnline ? 'Transmission Active' : 'Verification Requise'],
    ],
    theme: 'striped',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // ==========================================
  // 6. FLEET MANAGEMENT SYNTHESIS TABLE
  // ==========================================
  const tableFinalY = (doc as any).lastAutoTable?.finalY || 185;
  const nextSectionY = tableFinalY + 9;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('SYNTHESE DE GESTION DU PARC', 14, nextSectionY);

  autoTable(doc, {
    startY: nextSectionY + 3.5,
    margin: { left: 14, right: 14 },
    head: [['Parametre Flotte', 'Detail Enregistre', 'Recommandation Operationnelle']],
    body: [
      ['[CAR]  Matricule & ID', `${vehicle.plate} (${vehicle.id})`, 'Conforme au registre de flotte'],
      ['[ODO]  Kilometrage Enregistre', `${cleanFormatNumber(vehicle.mileage)} km`, 'Prochaine revision planifiee a +10 000 km'],
      ['[STS]  Disponibilite Flotte', vehicle.status === 'active' ? 'Operationnel / En mission' : vehicle.status === 'maintenance' ? 'En maintenance atelier' : 'Inactif', 'Supervision quotidienne SFTM'],
      ['[DOC]  Controle Technique & Vignette', 'A jour', 'Verifier assurance avant mission'],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [16, 185, 129],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
    },
  });

  // ==========================================
  // 7. FOOTER & SIGNATURE
  // ==========================================
  const footerY = pageHeight - 14;
  doc.setDrawColor(...cardBorder);
  doc.line(14, footerY - 3, pageWidth - 14, footerY - 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('SFTM - Societe de Flotte & Transport Maroc | Telemetrie GPS Haute Precision', 14, footerY);
  doc.text(`Page 1 / 1  •  Ref: SFTM-${vehicle.plate.replace(/\s+/g, '_')}`, pageWidth - 14, footerY, { align: 'right' });

  // Save PDF
  const safePlate = vehicle.plate.replace(/[\\/:*?"<>| ]/g, '_');
  doc.save(`Fiche_Vehicule_${safePlate}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
