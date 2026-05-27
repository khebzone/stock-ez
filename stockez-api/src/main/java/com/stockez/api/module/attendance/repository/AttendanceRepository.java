package com.stockez.api.module.attendance.repository;

import com.stockez.api.module.attendance.entity.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AttendanceRepository extends JpaRepository<Attendance, UUID> {

    Optional<Attendance> findByTenantIdAndUserIdAndAttendanceDate(UUID tenantId, UUID userId, LocalDate date);

    List<Attendance> findByTenantIdAndAttendanceDateOrderByUserFullNameAsc(UUID tenantId, LocalDate date);

    @Query("SELECT a FROM Attendance a WHERE a.tenant.id = :tenantId AND a.user.id = :userId " +
           "AND a.attendanceDate BETWEEN :from AND :to ORDER BY a.attendanceDate DESC")
    List<Attendance> findByTenantAndUserAndDateRange(
            @Param("tenantId") UUID tenantId,
            @Param("userId") UUID userId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query("SELECT a FROM Attendance a WHERE a.tenant.id = :tenantId " +
           "AND a.attendanceDate BETWEEN :from AND :to ORDER BY a.attendanceDate DESC, a.user.fullName ASC")
    List<Attendance> findByTenantAndDateRange(
            @Param("tenantId") UUID tenantId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);
}
