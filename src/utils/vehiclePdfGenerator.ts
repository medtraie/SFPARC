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
  const primaryColor: [number, number, number] = [15, 23, 42]; // Dark slate
  const accentEmerald: [number, number, number] = [16, 185, 129]; // Emerald
  const accentCyan: [number, number, number] = [6, 182, 212]; // Cyan
  const lightBg: [number, number, number] = [248, 250, 252]; // Slate 50
  const cardBorder: [number, number, number] = [226, 232, 240]; // Slate 200

  // 1. Draw Luxury Header with Gradient-like banner
  const headerHeight = 36;
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // Decorative top accent strip
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, pageWidth, 3, 'F');

  // Decorative cyan circle glow in header
  doc.setFillColor(6, 182, 212);
  doc.circle(pageWidth - 16, 18, 12, 'F');
  doc.setFillColor(15, 23, 42);
  doc.circle(pageWidth - 16, 18, 11, 'F');

  // Logo / System Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('SFTM FLEET INTELLIGENCE', 14, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('FICHE TECHNIQUE & RAPPORT DE TÉLÉMÉTRIE EN TEMPS RÉEL', 14, 23);
  doc.text(`Document généré le : ${new Date().toLocaleString('fr-FR')}`, 14, 29);

  // Status Badge in Header
  const isOnline = vehicle.online === 'online' || vehicle.online === 'ack';
  const speed = vehicle.lastPosition?.speed || 0;
  const isMoving = isOnline && speed > 0;
  const statusLabel = !isOnline
    ? 'HORS LIGNE'
    : vehicle.status === 'maintenance'
    ? 'MAINTENANCE'
    : isMoving
    ? 'EN MOUVEMENT'
    : "À L'ARRÊT";

  const badgeX = pageWidth - 65;
  const badgeY = 12;
  const badgeW = 45;
  const badgeH = 12;

  if (isMoving) {
    doc.setFillColor(6, 78, 59); // Emerald 900
    doc.setDrawColor(16, 185, 129);
    doc.setTextColor(167, 243, 208);
  } else if (!isOnline) {
    doc.setFillColor(127, 29, 29); // Red 900
    doc.setDrawColor(239, 68, 68);
    doc.setTextColor(254, 202, 202);
  } else {
    doc.setFillColor(120, 53, 15); // Amber 900
    doc.setDrawColor(245, 158, 11);
    doc.setTextColor(254, 240, 138);
  }

  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(statusLabel, badgeX + badgeW / 2, badgeY + 7.5, { align: 'center' });

  // 2. Vehicle Identification Banner
  let curY = 44;
  doc.setFillColor(...lightBg);
  doc.setDrawColor(...cardBorder);
  doc.roundedRect(14, curY, pageWidth - 28, 24, 3, 3, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(vehicle.plate, 20, curY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  const modelText = vehicle.brand ? `${vehicle.brand} ${vehicle.model || ''}` : 'Véhicule de Flotte';
  doc.text(modelText, 20, curY + 17);

  // Driver on the right side of the banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('CONDUCTEUR ASSIGNÉ', pageWidth - 20, curY + 9, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(16, 185, 129);
  doc.text(vehicle.driver || 'Non assigné', pageWidth - 20, curY + 17, { align: 'right' });

  // 3. Four Major Metric Cards (Grid 2x2 or 4 Columns)
  curY = 74;
  const colW = (pageWidth - 28 - 9) / 4;
  const colH = 26;

  const topSpeed = vehicle.topSpeedToday !== undefined && vehicle.topSpeedToday !== null
    ? `${vehicle.topSpeedToday.toFixed(0)} km/h`
    : `${speed.toFixed(0)} km/h`;
  const distanceJour = vehicle.distanceToday !== undefined && vehicle.distanceToday !== null
    ? `${vehicle.distanceToday.toLocaleString('fr-FR')} km`
    : '0 km';
  const odometre = `${vehicle.mileage.toLocaleString('fr-FR')} km`;
  const stopDuration = vehicle.lastPosition?.stopDuration || (isMoving ? 'En mouvement' : '00h 55m');

  const cardsData = [
    { label: 'V.MAX DU JOUR', value: topSpeed, color: [16, 185, 129], iconText: 'SPEED' },
    { label: 'DISTANCE JOUR', value: distanceJour, color: [6, 182, 212], iconText: 'DIST' },
    { label: 'ODOMÈTRE TOTAL', value: odometre, color: [99, 102, 241], iconText: 'ODO' },
    { label: "DURÉE D'ARRÊT", value: stopDuration, color: [245, 158, 11], iconText: 'STOP' },
  ];

  cardsData.forEach((c, idx) => {
    const x = 14 + idx * (colW + 3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...cardBorder);
    doc.roundedRect(x, curY, colW, colH, 2.5, 2.5, 'FD');

    // Colored top line
    doc.setFillColor(c.color[0], c.color[1], c.color[2]);
    doc.rect(x, curY, colW, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(c.label, x + 4, curY + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    doc.text(c.value, x + 4, curY + 18);
  });

  // 4. Real-time Location Box
  curY = 106;
  doc.setFillColor(...lightBg);
  doc.setDrawColor(...cardBorder);
  doc.roundedRect(14, curY, pageWidth - 28, 22, 2.5, 2.5, 'FD');

  doc.setFillColor(16, 185, 129);
  doc.circle(20, curY + 8, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(16, 185, 129);
  doc.text('DERNIÈRE POSITION GPS CONNUE', 25, curY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  const addressText = vehicle.lastPosition?.city
    ? `${vehicle.lastPosition.city} (Coordonnées: ${vehicle.lastPosition.lat.toFixed(5)}, ${vehicle.lastPosition.lng.toFixed(5)})`
    : vehicle.lastPosition
    ? `Coordonnées GPS: ${vehicle.lastPosition.lat.toFixed(5)}, ${vehicle.lastPosition.lng.toFixed(5)}`
    : 'Données GPS non disponibles';
  doc.text(addressText, 25, curY + 16);

  // 5. Telematics Gauge Table
  curY = 134;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('INDICATEURS TÉLÉMÉTRIQUES & CAPTEURS', 14, curY);

  const fuelText = vehicle.fuelQuantity !== null && vehicle.fuelQuantity !== undefined ? `${vehicle.fuelQuantity.toFixed(0)} L` : 'Non mesuré';
  const batteryText = vehicle.battery !== null && vehicle.battery !== undefined ? `${vehicle.battery.toFixed(0)} %` : 'Non mesuré';
  const networkText = vehicle.network !== null && vehicle.network !== undefined ? `${vehicle.network.toFixed(0)} %` : 'Non mesuré';
  const currentSpeedText = `${speed.toFixed(0)} km/h`;

  autoTable(doc, {
    startY: curY + 4,
    margin: { left: 14, right: 14 },
    head: [['Capteur / Télémétrie', 'Valeur Actuelle', 'Statut Normalisé', 'Évaluation Système']],
    body: [
      ['Niveau de Carburant (Réservoir)', fuelText, fuelText !== 'Non mesuré' ? 'Actif' : 'N/A', Number(vehicle.fuelQuantity) < 20 ? 'Alerte Réserve' : 'Niveau Optimal'],
      ['Batterie / Tension Véhicule', batteryText, batteryText !== 'Non mesuré' ? 'Connecté' : 'N/A', Number(vehicle.battery) < 20 ? 'Faible' : 'Conforme'],
      ['Couverture Réseau GSM / GPS', networkText, networkText !== 'Non mesuré' ? 'Signal Stable' : 'N/A', Number(vehicle.network) < 30 ? 'Moyen' : 'Excellent'],
      ['Vitesse Instantanée', currentSpeedText, isMoving ? 'En Déplacement' : 'Stationnaire', isMoving ? 'Flux continu' : 'Moteur Coupé / Ralenti'],
      ['État Boîtier Traceur', isOnline ? 'Connecté en Direct' : 'Déconnecté', isOnline ? 'Online (Synchro OK)' : 'Offline', isOnline ? 'Transmission en temps réel' : 'Vérification requise'],
    ],
    theme: 'striped',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // 6. Fleet Analytics Summary Table
  const tableFinalY = (doc as any).lastAutoTable?.finalY || 190;
  const nextSectionY = tableFinalY + 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('SYNTHÈSE DE GESTION DU PARC', 14, nextSectionY);

  autoTable(doc, {
    startY: nextSectionY + 4,
    margin: { left: 14, right: 14 },
    head: [['Paramètre', 'Détail', 'Recommandation']],
    body: [
      ['Matricule & Identifiant', `${vehicle.plate} (${vehicle.id})`, 'Conforme au registre de flotte'],
      ['Kilométrage Enregistré', `${vehicle.mileage.toLocaleString('fr-FR')} km`, 'Planification prochaine révision à 10 000 km'],
      ['Disponibilité Opérationnelle', vehicle.status === 'active' ? 'Disponible pour missions' : vehicle.status === 'maintenance' ? 'En atelier de maintenance' : 'Inactif', 'Suivi quotidien via plateforme SFTM'],
      ['Périodicité Contrôle Technique', 'À jour', 'Contrôler l\'assurance et la vignette'],
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [16, 185, 129],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
    },
  });

  // 7. Footer & Quality Seal
  const footerY = pageHeight - 16;
  doc.setDrawColor(...cardBorder);
  doc.line(14, footerY - 4, pageWidth - 14, footerY - 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('SFTM - Société de Flotte & Transport Maroc | Système Télématique Haute Précision', 14, footerY);
  doc.text(`Page 1 / 1  •  Réf : SFTM-V-${vehicle.plate.replace(/\s+/g, '_')}`, pageWidth - 14, footerY, { align: 'right' });

  // Save the document with clean filename
  const safePlate = vehicle.plate.replace(/[\\/:*?"<>| ]/g, '_');
  doc.save(`Fiche_Vehicule_${safePlate}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
