const mockData = {
  schemes: [
    {
      id: "S001",
      name: "Swasthya Raksha Yojana",
      category: "Health",
      description: "Comprehensive health coverage for low-income families providing up to ₹5,00,000 per family per year for secondary and tertiary care hospitalization.",
      benefits: ["Free medical treatment up to ₹5 Lakhs", "Includes pre-existing diseases", "Cashless access to empanelled hospitals"],
      eligibility: {
        maxIncome: 250000,
        categories: ["SC", "ST", "OBC", "General"],
        ageMin: 0,
        ageMax: 100,
        states: ["All"],
        disability: "any"
      }
    },
    {
      id: "S002",
      name: "Vidyarthi Vikas Scholarship",
      category: "Education",
      description: "Financial assistance to meritorious students from economically weaker sections to pursue higher education.",
      benefits: ["₹10,000 annual scholarship", "Free laptops for top performers", "Hostel fee waiver"],
      eligibility: {
        maxIncome: 150000,
        categories: ["SC", "ST", "OBC"],
        ageMin: 18,
        ageMax: 25,
        states: ["All"],
        disability: "any"
      }
    },
    {
      id: "S003",
      name: "Mahila Samridhi Nidhi",
      category: "Empowerment",
      description: "A micro-finance scheme to encourage women entrepreneurs to start their own small businesses.",
      benefits: ["Subsidized loans up to ₹2 Lakhs", "Skill development training", "Market linkage support"],
      eligibility: {
        maxIncome: 300000,
        categories: ["SC", "ST", "OBC", "General"],
        gender: "Female",
        ageMin: 18,
        ageMax: 55,
        states: ["All"],
        disability: "any"
      }
    },
    {
      id: "S004",
      name: "Divyang Sahayata Abhiyan",
      category: "Disability Support",
      description: "Provides financial aid, assistive devices, and accessible education for persons with disabilities.",
      benefits: ["Free motorized tricycles or hearing aids", "₹2,500 monthly pension", "Reservation in government jobs"],
      eligibility: {
        maxIncome: 500000,
        categories: ["SC", "ST", "OBC", "General"],
        ageMin: 0,
        ageMax: 100,
        states: ["All"],
        disability: "yes" // specific to disabled users
      }
    },
    {
      id: "S005",
      name: "Kisan Krishi Vikas Nidhi",
      category: "Agriculture",
      description: "Direct income support to farmer families, helping them manage agricultural expenses and seasonal hardships.",
      benefits: ["₹6,000 per year direct cash transfer", "Subsidized seeds and fertilizers", "Crop insurance premium waiver"],
      eligibility: {
        maxIncome: 800000,
        categories: ["SC", "ST", "OBC", "General"],
        occupation: "Farmer",
        ageMin: 18,
        ageMax: 80,
        states: ["All"],
        disability: "any"
      }
    }
  ],
  ngos: [
    {
      id: "N001",
      name: "Kolkata Care Foundation",
      area: "Health & Education",
      location: "Salt Lake City, Kolkata",
      distance: "4.2 km",
      contact: "hello@kolkatacare.org | +91 9876543210",
      rating: 4.8,
      reviews: [
        { user: "Rajesh K.", text: "Helped me secure the Swasthya Raksha benefits for my mother smoothly.", stars: 5 },
        { user: "Priya S.", text: "Very responsive and helpful staff.", stars: 4 }
      ]
    },
    {
      id: "N002",
      name: "Bengal Women Empowerment Trust",
      area: "Women Empowerment",
      location: "Park Street, Kolkata",
      distance: "6.5 km",
      contact: "info@bwet.org | +91 8765432109",
      rating: 4.9,
      reviews: [
        { user: "Anita D.", text: "Their guidance got my micro-loan approved in 2 weeks!", stars: 5 }
      ]
    },
    {
      id: "N003",
      name: "Kisan Sahay Kolkata",
      area: "Agriculture Support",
      location: "New Town, Kolkata",
      distance: "12.0 km",
      contact: "reach@kisansahay.in | +91 7654321098",
      rating: 4.5,
      reviews: [
        { user: "Bikash P.", text: "Helped me with the documentation for crop insurance.", stars: 4 },
        { user: "Arun M.", text: "Good initiative but lines can be long.", stars: 4 }
      ]
    },
    {
      id: "N004",
      name: "Aparajita Disability Network",
      area: "Disability Support",
      location: "Jadavpur, Kolkata",
      distance: "8.1 km",
      contact: "support@aparajita.org | +91 9988776655",
      rating: 5.0,
      reviews: [
        { user: "Surya T.", text: "Life-changing support for acquiring my motorized wheelchair.", stars: 5 }
      ]
    }
  ],
  stories: [
    {
      name: "Meena Devi",
      scheme: "Mahila Samridhi Nidhi",
      story: "Before receiving the fund, I worked as a daily wage laborer. With the assistance of the Bengal Women Empowerment Trust, I applied for the Mahila Samridhi Nidhi. Today, I run a successful tailoring shop employing three other women in Kolkata.",
      imagePlaceholder: "women-tailor.jpg"
    },
    {
      name: "Arun Bhattacharya",
      scheme: "Swasthya Raksha Yojana",
      story: "When my father needed emergency heart surgery, the cost was unbearable. Thanks to this portal, I found the Swasthya Raksha Yojana and immediately connected with Kolkata Care Foundation. His operation was fully covered.",
      imagePlaceholder: "family-health.jpg"
    },
    {
      name: "Sunita Mahato",
      scheme: "Vidyarthi Vikas Scholarship",
      story: "Coming from a rural background near Kolkata, higher education seemed impossible. The scholarship enabled me to purse my B.Tech degree, and I am now working full-time at an IT firm.",
      imagePlaceholder: "student-success.jpg"
    }
  ]
};
