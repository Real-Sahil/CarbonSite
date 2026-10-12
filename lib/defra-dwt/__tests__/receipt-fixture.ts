// A receipt that passes the schema as it stands: one road-carried, single-item, non-hazardous load with a D/R code.
// Tests change one field at a time from here, so a failure names the rule that moved.
export const baseReceipt = () => ({
  apiCode: "1f83215e-4b90-4785-9ab2-2614839aa2e9",
  dateTimeReceived: "2026-10-05T09:30:00Z",
  wasteItems: [
    {
      ewcCodes: ["170904"],
      wasteDescription: "Basic mixed construction and demolition waste, this includes recyclable house bricks, gypsum plaster and slates.",
      physicalForm: "Solid",
      numberOfContainers: 1,
      typeOfContainers: "SKI",
      weight: { metric: "Tonnes", amount: 6.9, isEstimate: false },
      disposalOrRecoveryCodes: [{ code: "R1", weight: { metric: "Tonnes", amount: 6.9, isEstimate: false } }],
      containsPops: false,
      containsHazardous: false,
    },
  ],
  carrier: { registrationNumber: "CBDL12345", organisationName: "A Haulier", meansOfTransport: "Road", vehicleRegistration: "RNT 493" },
  receiver: { siteName: "Depot", authorisationNumber: "EPR/AB1234CD" },
  receipt: { address: { fullAddress: "1 Yard Lane", postcode: "RG1 1AA" } },
});
