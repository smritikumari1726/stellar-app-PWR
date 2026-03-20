#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Env, String};

#[test]
fn test_register_and_get_product() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    client.register_product(
        &String::from_str(&env, "PROD-001"),
        &String::from_str(&env, "Apple"),
        &String::from_str(&env, "iPhone 15"),
        &12,
        &owner,
    );

    let product = client
        .get_product(&String::from_str(&env, "PROD-001"))
        .unwrap();
    assert_eq!(product.manufacturer, String::from_str(&env, "Apple"));
    assert_eq!(product.model, String::from_str(&env, "iPhone 15"));
    assert_eq!(product.warranty_months, 12);
}

#[test]
fn test_warranty_validity() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    client.register_product(
        &String::from_str(&env, "PROD-002"),
        &String::from_str(&env, "Samsung"),
        &String::from_str(&env, "Galaxy S24"),
        &24,
        &owner,
    );

    // Warranty should be valid immediately after registration
    assert!(client.is_warranty_valid(&String::from_str(&env, "PROD-002")));
    assert!(client
        .get_warranty_expiry(&String::from_str(&env, "PROD-002"))
        .is_some());
}

#[test]
fn test_warranty_invalid_for_nonexistent() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    assert!(!client.is_warranty_valid(&String::from_str(&env, "NONEXISTENT")));
    assert!(client
        .get_warranty_expiry(&String::from_str(&env, "NONEXISTENT"))
        .is_none());
}

#[test]
fn test_transfer_ownership() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let original_owner = Address::generate(&env);
    let new_owner = Address::generate(&env);

    client.register_product(
        &String::from_str(&env, "PROD-003"),
        &String::from_str(&env, "Dell"),
        &String::from_str(&env, "XPS 15"),
        &12,
        &original_owner,
    );

    // Transfer ownership (permissionless - no auth required)
    client.transfer_ownership(&String::from_str(&env, "PROD-003"), &new_owner);

    let product = client
        .get_product(&String::from_str(&env, "PROD-003"))
        .unwrap();
    assert_eq!(product.owner, new_owner);
}

#[test]
fn test_product_count_and_list() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);

    // Register multiple products
    client.register_product(
        &String::from_str(&env, "PROD-A"),
        &String::from_str(&env, "Brand A"),
        &String::from_str(&env, "Model A"),
        &12,
        &owner.clone(),
    );
    client.register_product(
        &String::from_str(&env, "PROD-B"),
        &String::from_str(&env, "Brand B"),
        &String::from_str(&env, "Model B"),
        &24,
        &owner.clone(),
    );
    client.register_product(
        &String::from_str(&env, "PROD-C"),
        &String::from_str(&env, "Brand C"),
        &String::from_str(&env, "Model C"),
        &36,
        &owner,
    );

    assert_eq!(client.get_product_count(), 3);

    let all_products = client.get_all_products();
    assert_eq!(all_products.len(), 3);
}

#[test]
#[should_panic(expected = "Product already registered")]
fn test_duplicate_registration_fails() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    client.register_product(
        &String::from_str(&env, "DUPE-001"),
        &String::from_str(&env, "Brand"),
        &String::from_str(&env, "Model"),
        &12,
        &owner,
    );

    // Try to register same product again
    client.register_product(
        &String::from_str(&env, "DUPE-001"),
        &String::from_str(&env, "Brand"),
        &String::from_str(&env, "Model"),
        &12,
        &owner,
    );
}

#[test]
#[should_panic(expected = "Product not found")]
fn test_transfer_nonexistent_product_fails() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    let new_owner = Address::generate(&env);
    client.transfer_ownership(&String::from_str(&env, "NONEXISTENT"), &new_owner);
}
