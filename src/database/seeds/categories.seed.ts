import { DataSource } from "typeorm";
import { Category } from "../entities/category.entity";

export async function seedCategories(dataSource: DataSource) {
  const categoryRepository = dataSource.getRepository(Category);

  const categories = [
    {
      name: "BankLogs",
      slug: "bank-logs",
      description: "bank logs for users. ",
      is_active: true,
      sort_order: 1,
    },
    {
      name: "Transfer",
      slug: "transfer",
      description: "all us transfers",
      is_active: true,
      sort_order: 2,
    },
    {
      name: "Accounts",
      slug: "accounts",
      description: "All kind of accounts",
      is_active: true,
      sort_order: 3,
    },
    {
      name: "Methods",
      slug: "method",
      description: "all cheque methods ",
      is_active: true,
      sort_order: 4,
    },
  ];

  for (const categoryData of categories) {
    const existingCategory = await categoryRepository.findOne({
      where: { slug: categoryData.slug },
    });

    if (!existingCategory) {
      const category = categoryRepository.create(categoryData);
      await categoryRepository.save(category);
      console.log(`Created category: ${categoryData.name}`);
    }
  }
}
