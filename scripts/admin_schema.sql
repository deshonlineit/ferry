-- Ferry admin backend schema (ft_ prefix, ferry_local)
SET FOREIGN_KEY_CHECKS=0;

DROP TABLE IF EXISTS ft_role_permissions;
DROP TABLE IF EXISTS ft_admin_activity_log;
DROP TABLE IF EXISTS ft_admin_sessions;
DROP TABLE IF EXISTS ft_admin_users;
DROP TABLE IF EXISTS ft_admin_roles;
DROP TABLE IF EXISTS ft_admin_permissions;
DROP TABLE IF EXISTS ft_site_content;

CREATE TABLE ft_admin_roles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(191) NOT NULL,
  slug VARCHAR(191) NOT NULL,
  description TEXT,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_name (name),
  UNIQUE KEY uq_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ft_admin_permissions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pkey VARCHAR(191) NOT NULL,
  name VARCHAR(191) NOT NULL,
  pgroup VARCHAR(128) DEFAULT 'General',
  PRIMARY KEY (id),
  UNIQUE KEY uq_key (pkey)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ft_admin_users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(191) NOT NULL,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT UNSIGNED DEFAULT NULL,
  full_name VARCHAR(191) DEFAULT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  last_login DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_username (username),
  UNIQUE KEY uq_email (email),
  KEY idx_role (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ft_role_permissions (
  role_id INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  KEY idx_perm (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ft_admin_sessions (
  id VARCHAR(128) NOT NULL,
  admin_user_id INT UNSIGNED DEFAULT NULL,
  payload TEXT,
  created_at DATETIME DEFAULT NULL,
  expires_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_user (admin_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ft_admin_activity_log (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_user_id INT UNSIGNED DEFAULT NULL,
  action VARCHAR(64) DEFAULT NULL,
  entity VARCHAR(64) DEFAULT NULL,
  entity_id INT UNSIGNED DEFAULT NULL,
  detail JSON DEFAULT NULL,
  created_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_user (admin_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ft_site_content (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  section_key VARCHAR(191) NOT NULL,
  title VARCHAR(255) DEFAULT NULL,
  body LONGTEXT,
  meta JSON DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_section (section_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS=1;

-- Permissions
INSERT INTO ft_admin_permissions (pkey, name, pgroup) VALUES
('dashboard.view','View dashboard','Dashboard'),
('products.view','View products','Products'),
('products.create','Create products','Products'),
('products.edit','Edit products','Products'),
('products.delete','Delete products','Products'),
('categories.view','View categories','Catalog'),
('categories.create','Create categories','Catalog'),
('categories.edit','Edit categories','Catalog'),
('categories.delete','Delete categories','Catalog'),
('attributes.view','View attributes','Catalog'),
('attributes.create','Manage attributes','Catalog'),
('media.view','View media','Catalog'),
('media.upload','Upload media','Catalog'),
('customers.view','View customers','Customers'),
('customers.edit','Edit customers','Customers'),
('orders.view','View orders','Orders'),
('orders.edit','Edit orders','Orders'),
('content.view','View content','Content'),
('content.edit','Edit content','Content'),
('settings.view','View settings','Settings'),
('settings.edit','Edit settings','Settings'),
('admin_users.view','View admin users','Administration'),
('admin_users.create','Create admin users','Administration'),
('admin_users.edit','Edit admin users','Administration'),
('admin_users.delete','Delete admin users','Administration'),
('roles.view','View roles','Administration'),
('roles.create','Create roles','Administration'),
('roles.edit','Edit roles','Administration'),
('roles.delete','Delete roles','Administration'),
('activity.view','View activity log','Administration');

-- Roles
INSERT INTO ft_admin_roles (id, name, slug, description, status, created_at) VALUES
(1,'Super Admin','super_admin','Full access to everything', 'active', NOW()),
(2,'Admin','admin','Manages store content and operations', 'active', NOW()),
(3,'Editor','editor','Manages products and catalog', 'active', NOW()),
(4,'Support','support','Handles customers and orders', 'active', NOW());

-- Role permissions
-- Super admin: all
INSERT INTO ft_role_permissions (role_id, permission_id)
  SELECT 1, id FROM ft_admin_permissions;
-- Admin: everything except role/admin_user management delete of admins (give all store + admin view)
INSERT INTO ft_role_permissions (role_id, permission_id)
  SELECT 2, id FROM ft_admin_permissions WHERE pkey NOT IN ('admin_users.delete','roles.delete');
-- Editor: products + categories + attributes + media
INSERT INTO ft_role_permissions (role_id, permission_id)
  SELECT 3, id FROM ft_admin_permissions WHERE pkey IN
  ('dashboard.view','products.view','products.create','products.edit','products.delete',
   'categories.view','categories.create','categories.edit','categories.delete',
   'attributes.view','attributes.create','media.view','media.upload','content.view');
-- Support: customers + orders + view
INSERT INTO ft_role_permissions (role_id, permission_id)
  SELECT 4, id FROM ft_admin_permissions WHERE pkey IN
  ('dashboard.view','customers.view','customers.edit','orders.view','orders.edit','content.view');

-- Default admin user: admin@ferry.local / Admin@1234
INSERT INTO ft_admin_users (username, email, password_hash, role_id, full_name, status, created_at, updated_at)
VALUES ('admin', 'admin@ferry.local',
        '$2y$10$T.MWfDIIkJholD1GI8BHp.LjGqiDpc8L4cAqQ6pLtyfTlB2eZ62De',
        1, 'Site Administrator', 'active', NOW(), NOW());

-- Seed dynamic site content sections
INSERT INTO ft_site_content (section_key, title, body, meta, updated_at) VALUES
('announcement','Free shipping on wholesale orders','Secure B2B checkout for Switzerland &amp; Luxembourg.', NULL, NOW()),
('about','About Ferrytelecom','Your B2B wholesale partner for mobile phone parts, accessories and repair equipment. Serving Switzerland &amp; Luxembourg.', NULL, NOW()),
('footer_contact','Contact','Wholesale enquiries &amp; support.', NULL, NOW()),
('seo','SEO','SEO metadata for the storefront.','{"title":"Ferrytelecom — Wholesale Mobile Parts","description":"B2B wholesale mobile phone parts, accessories and repair equipment. Switzerland & Luxembourg.","keywords":"wholesale, mobile parts, repair"}', NOW());
