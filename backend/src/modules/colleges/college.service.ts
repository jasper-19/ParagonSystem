import * as repository from "./college.repository";

export async function getColleges() {
  return repository.findAll();
}

