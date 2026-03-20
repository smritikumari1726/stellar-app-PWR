#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Map, String, Vec};

#[contracttype]
#[derive(Clone)]
pub struct Product {
    pub manufacturer: String,
    pub model: String,
    pub owner: Address,
    pub registration_time: u64,
    pub warranty_months: u32,
}

#[contracttype]
pub enum DataKey {
    Products,
    ProductIds,
}

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    /// Register a new product with warranty. Anyone can call this (permissionless).
    pub fn register_product(
        env: Env,
        product_id: String,
        manufacturer: String,
        model: String,
        warranty_months: u32,
        owner: Address,
    ) {
        let mut products: Map<String, Product> = env
            .storage()
            .instance()
            .get(&DataKey::Products)
            .unwrap_or_else(|| Map::new(&env));

        assert!(
            !products.contains_key(product_id.clone()),
            "Product already registered"
        );

        let product = Product {
            manufacturer,
            model,
            owner,
            registration_time: env.ledger().timestamp(),
            warranty_months,
        };

        products.set(product_id.clone(), product);

        let mut product_ids: Vec<String> = env
            .storage()
            .instance()
            .get(&DataKey::ProductIds)
            .unwrap_or_else(|| Vec::new(&env));
        product_ids.push_back(product_id);

        env.storage().instance().set(&DataKey::Products, &products);
        env.storage()
            .instance()
            .set(&DataKey::ProductIds, &product_ids);
    }

    /// Get product details. Anyone can call this (permissionless).
    pub fn get_product(env: Env, product_id: String) -> Option<Product> {
        let products: Map<String, Product> = env
            .storage()
            .instance()
            .get(&DataKey::Products)
            .unwrap_or_else(|| Map::new(&env));
        products.get(product_id)
    }

    /// Check if warranty is still valid. Anyone can call this (permissionless).
    pub fn is_warranty_valid(env: Env, product_id: String) -> bool {
        let products: Map<String, Product> = env
            .storage()
            .instance()
            .get(&DataKey::Products)
            .unwrap_or_else(|| Map::new(&env));

        match products.get(product_id) {
            None => false,
            Some(product) => {
                let warranty_seconds: u64 = (product.warranty_months as u64) * 30 * 24 * 60 * 60;
                let expiry_time = product.registration_time + warranty_seconds;
                env.ledger().timestamp() < expiry_time
            }
        }
    }

    /// Get warranty expiry timestamp. Returns None if product not found.
    pub fn get_warranty_expiry(env: Env, product_id: String) -> Option<u64> {
        let products: Map<String, Product> = env
            .storage()
            .instance()
            .get(&DataKey::Products)
            .unwrap_or_else(|| Map::new(&env));

        match products.get(product_id) {
            None => None,
            Some(product) => {
                let warranty_seconds: u64 = (product.warranty_months as u64) * 30 * 24 * 60 * 60;
                Some(product.registration_time + warranty_seconds)
            }
        }
    }

    /// Transfer product ownership. Anyone can call this (permissionless).
    /// New owner is set directly without requiring current owner auth.
    pub fn transfer_ownership(env: Env, product_id: String, new_owner: Address) {
        let mut products: Map<String, Product> = env
            .storage()
            .instance()
            .get(&DataKey::Products)
            .unwrap_or_else(|| Map::new(&env));

        let mut product = products.get(product_id.clone()).expect("Product not found");

        product.owner = new_owner;
        products.set(product_id, product);
        env.storage().instance().set(&DataKey::Products, &products);
    }

    /// Get all registered product IDs. Anyone can call this (permissionless).
    pub fn get_all_products(env: Env) -> Vec<String> {
        env.storage()
            .instance()
            .get(&DataKey::ProductIds)
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Get total count of registered products.
    pub fn get_product_count(env: Env) -> u32 {
        let product_ids: Vec<String> = env
            .storage()
            .instance()
            .get(&DataKey::ProductIds)
            .unwrap_or_else(|| Vec::new(&env));
        product_ids.len()
    }
}

mod test;
