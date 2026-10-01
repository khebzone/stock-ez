package com.stockez.api.config;

import com.stockez.api.module.tenant.entity.Tenant;
import com.stockez.api.module.tenant.repository.TenantRepository;
import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class SuperAdminInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SuperAdminInitializer.class);

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(12);

    @Value("${stockez.super-admin.phone}")
    private String phone;

    @Value("${stockez.super-admin.password}")
    private String password;

    public SuperAdminInitializer(TenantRepository tenantRepository, UserRepository userRepository) {
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (tenantRepository.existsBySubdomain("platform")) {
            return;
        }

        Tenant tenant = Tenant.builder()
                .name("StockEz Platform")
                .schemaName("tenant_platform")
                .subdomain("platform")
                .ownerName("StockEz Admin")
                .phone(phone)
                .email("admin@stockez.in")
                .address("Chennai, Tamil Nadu")
                .city("Chennai")
                .state("Tamil Nadu")
                .status(Tenant.TenantStatus.ACTIVE)
                .plan(Tenant.TenantPlan.PREMIUM)
                .billingCycle("MONTHLY")
                .maxUsers(999)
                .build();
        tenant = tenantRepository.save(tenant);

        User user = User.builder()
                .tenant(tenant)
                .fullName("Super Admin")
                .phone(phone)
                .email("admin@stockez.in")
                .passwordHash(passwordEncoder.encode(password))
                .role(User.UserRole.SUPER_ADMIN)
                .active(true)
                .mustChangePassword(false)
                .build();
        userRepository.save(user);

        log.info("Super admin created — phone: {}", phone);
    }
}
