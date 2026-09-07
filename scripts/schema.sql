CREATE DATABASE IF NOT EXISTS ferry_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ferry_local;

SET FOREIGN_KEY_CHECKS=0;

DROP TABLE IF EXISTS ft_customers;
CREATE TABLE ft_customers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) DEFAULT NULL,
  company VARCHAR(191) DEFAULT NULL,
  vat_id VARCHAR(64) DEFAULT NULL,
  wholesale_approved TINYINT(1) NOT NULL DEFAULT 0,
  customer_group VARCHAR(32) NOT NULL DEFAULT 'retail',
  created_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS ft_addresses;
CREATE TABLE ft_addresses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id INT UNSIGNED DEFAULT NULL,
  type ENUM('billing','shipping') NOT NULL DEFAULT 'billing',
  name VARCHAR(191) DEFAULT NULL,
  company VARCHAR(191) DEFAULT NULL,
  line1 VARCHAR(255) DEFAULT NULL,
  line2 VARCHAR(255) DEFAULT NULL,
  city VARCHAR(128) DEFAULT NULL,
  postcode VARCHAR(32) DEFAULT NULL,
  country CHAR(2) DEFAULT 'CH',
  phone VARCHAR(64) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS ft_categories;
CREATE TABLE ft_categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  parent_id INT UNSIGNED DEFAULT NULL,
  slug VARCHAR(191) NOT NULL,
  name VARCHAR(191) NOT NULL,
  description TEXT,
  image VARCHAR(512) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_slug (slug),
  KEY idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS ft_attributes;
CREATE TABLE ft_attributes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(191) NOT NULL,
  name VARCHAR(191) NOT NULL,
  type ENUM('select','text') NOT NULL DEFAULT 'select',
  PRIMARY KEY (id),
  UNIQUE KEY uq_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS ft_attribute_values;
CREATE TABLE ft_attribute_values (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  attribute_id INT UNSIGNED NOT NULL,
  slug VARCHAR(191) NOT NULL,
  value VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attr_val (attribute_id, slug),
  KEY idx_attr (attribute_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS ft_products;
CREATE TABLE ft_products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sku VARCHAR(191) DEFAULT NULL,
  slug VARCHAR(191) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description LONGTEXT,
  status ENUM('publish','draft','private') NOT NULL DEFAULT 'publish',
  featured TINYINT(1) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  stock_status ENUM('instock','outofstock','onbackorder') NOT NULL DEFAULT 'instock',
  manages_stock TINYINT(1) NOT NULL DEFAULT 0,
  weight DECIMAL(8,2) DEFAULT NULL,
  min_order_qty INT NOT NULL DEFAULT 1,
  image VARCHAR(512) DEFAULT NULL,
  created_at DATETIME DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sku (sku),
  UNIQUE KEY uq_slug (slug),
  KEY idx_status (status),
  KEY idx_name (name(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS ft_product_categories;
CREATE TABLE ft_product_categories (
  product_id INT UNSIGNED NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (product_id, category_id),
  KEY idx_cat (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS ft_product_attributes;
CREATE TABLE ft_product_attributes (
  product_id INT UNSIGNED NOT NULL,
  attribute_value_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (product_id, attribute_value_id),
  KEY idx_av (attribute_value_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS ft_product_prices;
CREATE TABLE ft_product_prices (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  customer_group VARCHAR(32) NOT NULL DEFAULT 'retail',
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'CHF',
  PRIMARY KEY (id),
  UNIQUE KEY uq_prod_group (product_id, customer_group),
  KEY idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS ft_orders;
CREATE TABLE ft_orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_no VARCHAR(64) NOT NULL,
  customer_id INT UNSIGNED DEFAULT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'CHF',
  billing_snapshot JSON DEFAULT NULL,
  created_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_no (order_no),
  KEY idx_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS ft_order_items;
CREATE TABLE ft_order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED DEFAULT NULL,
  sku VARCHAR(191) DEFAULT NULL,
  name VARCHAR(255) DEFAULT NULL,
  qty INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS ft_order_status_history;
CREATE TABLE ft_order_status_history (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  status VARCHAR(32) NOT NULL,
  note TEXT,
  created_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS ft_carts;
CREATE TABLE ft_carts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id INT UNSIGNED DEFAULT NULL,
  session_id VARCHAR(128) DEFAULT NULL,
  created_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_session (session_id),
  KEY idx_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS ft_cart_items;
CREATE TABLE ft_cart_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cart_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cart_prod (cart_id, product_id),
  KEY idx_cart (cart_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS ft_rma;
CREATE TABLE ft_rma (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED DEFAULT NULL,
  customer_id INT UNSIGNED DEFAULT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  created_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS ft_rma_items;
CREATE TABLE ft_rma_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  rma_id INT UNSIGNED NOT NULL,
  order_item_id INT UNSIGNED DEFAULT NULL,
  qty INT NOT NULL DEFAULT 1,
  reason VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_rma (rma_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS ft_sessions;
CREATE TABLE ft_sessions (
  id VARCHAR(128) NOT NULL,
  customer_id INT UNSIGNED DEFAULT NULL,
  payload TEXT,
  created_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS ft_reviews;
CREATE TABLE ft_reviews (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  author VARCHAR(191) DEFAULT NULL,
  rating TINYINT UNSIGNED DEFAULT 0,
  content TEXT,
  created_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS ft_media;
CREATE TABLE ft_media (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED DEFAULT NULL,
  file_path VARCHAR(512) NOT NULL,
  mime VARCHAR(128) DEFAULT NULL,
  alt VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS ft_site_settings;
CREATE TABLE ft_site_settings (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(128) NOT NULL,
  value TEXT,
  PRIMARY KEY (id),
  UNIQUE KEY uq_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS=1;
