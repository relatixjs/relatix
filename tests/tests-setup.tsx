import { Tables, Text, Number, SelfRef } from "../src";

// Fonction utilitaire pour créer un modèle de base réutilisable
const createTestModel = (options?: Parameters<typeof Tables>[0]) =>
  Tables(options)
    .addTables({
      People: {
        name: Text,
        age: Number,
        favouriteCoWorker: SelfRef as typeof SelfRef | null, // Typage explicite pour union avec null
      },
      Projects: { title: Text, description: Text },
    })
    .addTables((Ref) => ({
      Tasks: {
        title: Text,
        assignedTo: Ref("People"), // Référence à People
        project: Ref("Projects"), // Référence à Projects
      },
    }))
    .populate(({ People, Projects }) => ({
      People: {
        alice: { name: "Alice", age: 25, favouriteCoWorker: People("bob") },
        bob: { name: "Bob", age: 30, favouriteCoWorker: null },
        james: { name: "James", age: 26, favouriteCoWorker: People("alice") },
      },
      Projects: {
        proj1: {
          title: "Website Redesign",
          description: "Revamp company site",
        },
        proj2: {
          title: "API Development",
          description: "Build new API endpoints",
        },
      },
      Tasks: {
        task1: {
          title: "Design Homepage",
          assignedTo: People("alice"),
          project: Projects("proj1"),
        },
        task2: {
          title: "Implement Login",
          assignedTo: People("bob"),
          project: Projects("proj1"),
        },
      },
    }));

export { createTestModel };
